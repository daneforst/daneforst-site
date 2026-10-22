import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import simd

/// A copy of one plane of a CVPixelBuffer (LiDAR depth or confidence), so the ARFrame can be let go.
struct PixelPlane<Value> {
    let width: Int
    let height: Int
    let values: [Value]

    init(_ buffer: CVPixelBuffer, empty: Value) {
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        let w = CVPixelBufferGetWidth(buffer)
        let h = CVPixelBufferGetHeight(buffer)
        let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
        var values = [Value](repeating: empty, count: w * h)
        values.withUnsafeMutableBytes { dst in
            guard let dstBase = dst.baseAddress, let src = CVPixelBufferGetBaseAddress(buffer) else { return }
            let rowLength = w * MemoryLayout<Value>.stride
            for y in 0..<h {
                (dstBase + y * rowLength).copyMemory(from: src + y * rowBytes, byteCount: rowLength)
            }
        }
        width = w
        height = h
        self.values = values
    }
}

/// Everything saved for one photo. The camera image stays a pixel buffer until it's encoded.
struct FrameCapture: @unchecked Sendable {
    let index: Int
    let timestamp: TimeInterval
    let image: CVPixelBuffer
    let imageSize: CGSize
    let depth: PixelPlane<Float>
    let confidence: PixelPlane<UInt8>?
    let transform: simd_float4x4
    let intrinsics: simd_float3x3
}

/// frames.json: the index of a scan, and the only file the processing scripts need to read first.
struct ScanManifest: Codable {
    struct Size: Codable {
        var width: Int
        var height: Int
    }

    struct DepthInfo: Codable {
        var width: Int
        var height: Int
        var encoding = "16-bit grayscale PNG"
        var unit = "millimeters, 0 = no reading"
        var confidence = "8-bit grayscale PNG: 0 = low, 1 = medium, 2 = high"
    }

    struct Intrinsics: Codable {
        var fx: Float
        var fy: Float
        var cx: Float
        var cy: Float
    }

    struct Frame: Codable {
        var index: Int
        var timestamp: Double
        var rgb: String
        var depth: String
        var confidence: String?
        var intrinsics: Intrinsics
        var transform: [[Float]]
        var position: [Float]
        var forward: [Float]
    }

    var format = "roomscan/1"
    var name: String
    var created: String
    var device: String
    var coordinates = "ARKit world space: meters, right-handed, +Y up (against gravity), origin where the scan started. "
        + "transform is camera-to-world as a row-major 4x4. The camera looks down its own -Z axis with +Y up, "
        + "while image pixels run +u right and +v down, so back-project a pixel as (x, -y, -depth). "
        + "intrinsics are in RGB pixels; scale them for the depth map. Photos are stored in the sensor's landscape orientation."
    var image: Size
    var depth: DepthInfo
    var mesh: String?
    var frames: [Frame]
}

/// Writes photos, depth and frames.json into the scan folder on its own queue.
final class ScanWriter: @unchecked Sendable {
    private(set) var folder: URL
    private let stamp: String
    private let queue = DispatchQueue(label: "roomscan.writer", qos: .utility)
    private let context = CIContext()
    private let created: Date
    private var name: String
    private var frames: [ScanManifest.Frame] = []
    private var imageSize = ScanManifest.Size(width: 0, height: 0)
    private var depthSize = ScanManifest.Size(width: 0, height: 0)
    private var hasMesh = false
    private var discarded = false

    enum WriteError: LocalizedError {
        case encode(String)
        var errorDescription: String? {
            switch self {
            case .encode(let file): return "Couldn't encode \(file)."
            }
        }
    }

    init(name: String) {
        let now = Date()
        let stamp = ScanStore.stamp(for: now)
        self.name = name
        self.stamp = stamp
        created = now
        folder = ScanStore.folderURL(name: name, stamp: stamp)
    }

    func rename(_ name: String) {
        queue.async { [self] in self.name = name }
    }

    func write(_ capture: FrameCapture, completion: @escaping @Sendable (Bool) -> Void) {
        queue.async { [self] in
            guard !discarded else { return completion(false) }
            do {
                try createFolders()
                let stem = String(format: "%06d", capture.index)
                let rgb = "rgb/\(stem).jpg"
                let depth = "depth/\(stem).png"
                let confidence = "confidence/\(stem).png"
                try writeJPEG(capture.image, to: folder.appendingPathComponent(rgb))
                try writeDepth(capture.depth, to: folder.appendingPathComponent(depth))
                if let plane = capture.confidence {
                    try writeGray(Data(plane.values), width: plane.width, height: plane.height, bits: 8,
                                  to: folder.appendingPathComponent(confidence))
                }

                let t = capture.transform
                let k = capture.intrinsics
                frames.append(ScanManifest.Frame(
                    index: capture.index,
                    timestamp: capture.timestamp,
                    rgb: rgb,
                    depth: depth,
                    confidence: capture.confidence == nil ? nil : confidence,
                    intrinsics: .init(fx: k.columns.0.x, fy: k.columns.1.y, cx: k.columns.2.x, cy: k.columns.2.y),
                    transform: (0..<4).map { r in [t.columns.0[r], t.columns.1[r], t.columns.2[r], t.columns.3[r]] },
                    position: [t.columns.3.x, t.columns.3.y, t.columns.3.z],
                    forward: [-t.columns.2.x, -t.columns.2.y, -t.columns.2.z]))
                imageSize = .init(width: Int(capture.imageSize.width), height: Int(capture.imageSize.height))
                depthSize = .init(width: capture.depth.width, height: capture.depth.height)

                // Keep frames.json current every so often, so a crash mid-scan still leaves a usable folder.
                if frames.count % 25 == 0 { try? writeManifest() }
                completion(true)
            } catch {
                completion(false)
            }
        }
    }

    /// Runs after every queued photo has been written.
    func finish(mesh chunks: [MeshChunk], completion: @escaping @Sendable (Result<URL, Error>) -> Void) {
        queue.async { [self] in
            do {
                try createFolders()
                if !chunks.isEmpty {
                    try MeshExporter.writeOBJ(chunks, to: folder.appendingPathComponent("mesh.obj"))
                    hasMesh = true
                }
                try moveToCurrentName()
                try writeManifest()
                completion(.success(folder))
            } catch {
                completion(.failure(error))
            }
        }
    }

    func discard() {
        queue.async { [self] in
            discarded = true
            try? FileManager.default.removeItem(at: folder)
        }
    }

    // MARK: - Files

    private func createFolders() throws {
        for sub in ["rgb", "depth", "confidence"] {
            try FileManager.default.createDirectory(at: folder.appendingPathComponent(sub, isDirectory: true),
                                                    withIntermediateDirectories: true)
        }
    }

    /// The scan can be renamed while it's being captured; the folder follows the final name.
    private func moveToCurrentName() throws {
        let target = ScanStore.folderURL(name: name, stamp: stamp)
        guard target != folder, !FileManager.default.fileExists(atPath: target.path) else { return }
        try FileManager.default.moveItem(at: folder, to: target)
        folder = target
    }

    private func writeManifest() throws {
        let manifest = ScanManifest(
            name: name,
            created: ISO8601DateFormatter().string(from: created),
            device: Self.deviceModel,
            image: imageSize,
            depth: .init(width: depthSize.width, height: depthSize.height),
            mesh: hasMesh ? "mesh.obj" : nil,
            frames: frames)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
        try encoder.encode(manifest).write(to: folder.appendingPathComponent("frames.json"), options: .atomic)
    }

    private func writeJPEG(_ buffer: CVPixelBuffer, to url: URL) throws {
        let image = CIImage(cvPixelBuffer: buffer)
        guard let space = CGColorSpace(name: CGColorSpace.sRGB),
              let data = context.jpegRepresentation(
                of: image, colorSpace: space,
                options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.9])
        else { throw WriteError.encode(url.lastPathComponent) }
        try data.write(to: url)
    }

    /// Depth goes out as 16-bit millimeters: lossless at LiDAR precision, and every image library reads it.
    private func writeDepth(_ plane: PixelPlane<Float>, to url: URL) throws {
        var millimeters = [UInt16](repeating: 0, count: plane.values.count)
        for i in 0..<plane.values.count {
            let d = plane.values[i]
            if d.isFinite && d > 0 { millimeters[i] = UInt16(min(d * 1000, 65535).rounded()) }
        }
        let data = millimeters.withUnsafeBufferPointer { Data(buffer: $0) }
        try writeGray(data, width: plane.width, height: plane.height, bits: 16, to: url)
    }

    private func writeGray(_ data: Data, width: Int, height: Int, bits: Int, to url: URL) throws {
        var info = CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue)
        if bits == 16 { info.insert(.byteOrder16Little) }
        guard let provider = CGDataProvider(data: data as CFData),
              let image = CGImage(width: width, height: height, bitsPerComponent: bits, bitsPerPixel: bits,
                                  bytesPerRow: width * bits / 8, space: CGColorSpaceCreateDeviceGray(),
                                  bitmapInfo: info, provider: provider, decode: nil,
                                  shouldInterpolate: false, intent: .defaultIntent),
              let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)
        else { throw WriteError.encode(url.lastPathComponent) }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { throw WriteError.encode(url.lastPathComponent) }
    }

    private static var deviceModel: String {
        var info = utsname()
        uname(&info)
        let size = MemoryLayout.size(ofValue: info.machine)
        return withUnsafePointer(to: &info.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: size) { String(cString: $0) }
        }
    }
}

/// ARKit's own scene mesh, saved alongside the photos. It's rough, but it's a free sanity check for alignment.
enum MeshExporter {
    static func writeOBJ(_ chunks: [MeshChunk], to url: URL) throws {
        var text = "# RoomScan: ARKit scene mesh in world space (meters, +Y up)\n"
        var offset = 1
        for chunk in chunks {
            for p in chunk.positions { text += "v \(p.x) \(p.y) \(p.z)\n" }
            for f in stride(from: 0, to: chunk.indices.count - 2, by: 3) {
                text += "f \(Int(chunk.indices[f]) + offset) \(Int(chunk.indices[f + 1]) + offset) \(Int(chunk.indices[f + 2]) + offset)\n"
            }
            offset += chunk.positions.count
        }
        try text.write(to: url, atomically: true, encoding: .utf8)
    }
}
