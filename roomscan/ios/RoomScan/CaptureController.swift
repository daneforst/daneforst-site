import ARKit
import RealityKit
import UIKit

/// Overlay colors, shared by the AR mesh and the HUD legend.
enum Palette {
    static let captured = UIColor(red: 0.20, green: 0.85, blue: 0.45, alpha: 1)
    static let missing = UIColor(red: 1.00, green: 0.27, blue: 0.30, alpha: 1)
}

/// Top-down view of the room for the HUD: sampled mesh points on the floor plane, plus where the phone is.
struct CoverageMap {
    var points: [SIMD2<Float>] = []
    var covered: [Bool] = []
    var camera = SIMD2<Float>(0, 0)
    var heading = SIMD2<Float>(0, -1)
}

/// Runs the AR session, decides when to save a photo, and keeps the coverage overlay current.
@MainActor
final class CaptureController: NSObject, ObservableObject {
    @Published var name: String { didSet { writer.rename(name) } }
    @Published private(set) var photoCount = 0
    @Published private(set) var wallCount = 0
    @Published private(set) var coverage = 0.0
    @Published private(set) var hint = "Walk slowly around the room. Photos are saved automatically as you move."
    @Published private(set) var status = "Starting…"
    @Published private(set) var isPaused = false
    @Published private(set) var isSaving = false
    @Published private(set) var isFinished = false
    @Published private(set) var map = CoverageMap()
    @Published var errorMessage: String?

    // A new photo once the phone has moved or turned this much since the last one.
    private let minMove: Float = 0.15
    private let minTurn: Float = 12 * .pi / 180
    private let minInterval: TimeInterval = 0.25
    // Faster than this and the photo comes out blurred.
    private let maxSpeed: Float = 0.6
    private let maxTurnRate: Float = .pi / 3

    private let writer: ScanWriter
    private let coverageModel = CoverageModel()
    private weak var arView: ARView?
    private let overlayRoot: AnchorEntity
    private let overlayMaterials: [any RealityKit.Material]
    private var overlays: [UUID: ModelEntity] = [:]

    private var nextIndex = 1
    private var pendingWrites = 0
    private var captureRequested = false
    private var tracking = false
    private var trackingHint = ""
    private var lastCapture: (pose: simd_float4x4, time: TimeInterval)?
    private var motionSample: (pose: simd_float4x4, time: TimeInterval)?
    private var frameTime: TimeInterval = 0
    private var tooFastUntil: TimeInterval = 0
    private var lastMapUpdate: TimeInterval = 0
    private var lastRefresh: TimeInterval = 0
    private var refreshing = false
    private var history: [(photos: Int, coverage: Double)] = []

    init(name: String) {
        self.name = name
        writer = ScanWriter(name: name)
        overlayRoot = AnchorEntity(world: SIMD3<Float>(0, 0, 0))
        var captured = UnlitMaterial(color: Palette.captured)
        captured.blending = .transparent(opacity: .init(floatLiteral: 0.35))
        var missing = UnlitMaterial(color: Palette.missing)
        missing.blending = .transparent(opacity: .init(floatLiteral: 0.45))
        overlayMaterials = [captured, missing]
        super.init()
    }

    // MARK: - Session

    func attach(to view: ARView) {
        arView = view
        view.session.delegate = self
        view.renderOptions = [.disablePersonOcclusion, .disableDepthOfField, .disableMotionBlur]
        view.scene.addAnchor(overlayRoot)
        start()
    }

    func start() {
        guard let view = arView else { return }
        guard ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh),
              ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else {
            status = "No LiDAR scanner"
            hint = "RoomScan needs an iPhone Pro or iPad Pro with a LiDAR scanner."
            return
        }
        let config = ARWorldTrackingConfiguration()
        config.sceneReconstruction = .mesh
        config.frameSemantics = [.sceneDepth]
        config.planeDetection = [.horizontal, .vertical]
        if UserDefaults.standard.bool(forKey: "hiResPhotos"),
           let format = ARWorldTrackingConfiguration.recommendedVideoFormatFor4KResolution {
            config.videoFormat = format
        }
        view.session.run(config)
        UIApplication.shared.isIdleTimerDisabled = true
    }

    func stop() {
        arView?.session.pause()
        UIApplication.shared.isIdleTimerDisabled = false
    }

    // MARK: - Buttons

    func togglePause() {
        isPaused.toggle()
        updateHint()
    }

    func captureNow() {
        captureRequested = true
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    func save() {
        guard !isSaving, photoCount > 0 else { return }
        isSaving = true
        isPaused = true
        let writer = self.writer
        writer.rename(name)
        coverageModel.snapshot { chunks in
            writer.finish(mesh: chunks) { result in
                Task { @MainActor in self.didSave(result) }
            }
        }
    }

    func discard() {
        stop()
        writer.discard()
        isFinished = true
    }

    private func didSave(_ result: Result<URL, Error>) {
        isSaving = false
        switch result {
        case .success:
            stop()
            isFinished = true
        case .failure(let error):
            errorMessage = "Couldn't save the scan: \(error.localizedDescription)"
            isPaused = false
        }
    }

    // MARK: - Frames

    private func process(_ frame: ARFrame) {
        let now = frame.timestamp
        let pose = frame.camera.transform
        frameTime = now

        // Speed over ~0.1 s windows; per-frame deltas are too jittery to judge blur by.
        if let sample = motionSample {
            if now - sample.time >= 0.1 {
                let dt = Float(now - sample.time)
                if simd_distance(translation(of: pose), translation(of: sample.pose)) / dt > maxSpeed
                    || viewAngle(pose, sample.pose) / dt > maxTurnRate {
                    tooFastUntil = now + 0.6
                }
                motionSample = (pose, now)
            }
        } else {
            motionSample = (pose, now)
        }

        if now - lastMapUpdate > 0.1 {
            lastMapUpdate = now
            map.camera = SIMD2(pose.columns.3.x, pose.columns.3.z)
            let forward = SIMD2(-pose.columns.2.x, -pose.columns.2.z)
            if simd_length(forward) > 0.01 { map.heading = simd_normalize(forward) }
        }
        if now - lastRefresh > 0.5 {
            lastRefresh = now
            refreshCoverage()
        }

        guard case .normal = frame.camera.trackingState, frame.sceneDepth != nil, !isSaving else { return }
        if captureRequested {
            guard pendingWrites < 6 else { return }
            captureRequested = false
        } else {
            guard !isPaused, now >= tooFastUntil, pendingWrites < 3 else { return }
            if let last = lastCapture {
                guard now - last.time > minInterval,
                      simd_distance(translation(of: pose), translation(of: last.pose)) > minMove
                        || viewAngle(pose, last.pose) > minTurn
                else { return }
            }
        }
        capture(frame)
    }

    private func capture(_ frame: ARFrame) {
        guard let depth = frame.sceneDepth else { return }
        let shot = FrameCapture(
            index: nextIndex,
            timestamp: frame.timestamp,
            image: frame.capturedImage,
            imageSize: frame.camera.imageResolution,
            depth: PixelPlane(depth.depthMap, empty: Float(0)),
            confidence: depth.confidenceMap.map { PixelPlane($0, empty: UInt8(0)) },
            transform: frame.camera.transform,
            intrinsics: frame.camera.intrinsics)
        nextIndex += 1
        lastCapture = (shot.transform, shot.timestamp)
        pendingWrites += 1
        photoCount += 1
        writer.write(shot) { ok in
            Task { @MainActor in self.didWrite(ok) }
        }
        coverageModel.addPhoto(shot)
    }

    private func didWrite(_ ok: Bool) {
        pendingWrites -= 1
        if !ok {
            photoCount -= 1
            status = "Couldn't save a photo. Is storage full?"
        }
    }

    // MARK: - Mesh and coverage

    private func ingest(_ anchors: [ARAnchor], in session: ARSession) {
        var planesChanged = false
        for anchor in anchors {
            if let mesh = anchor as? ARMeshAnchor {
                coverageModel.update(MeshChunk(mesh))
            } else if anchor is ARPlaneAnchor {
                planesChanged = true
            }
        }
        if planesChanged { countWalls(in: session) }
    }

    private func countWalls(in session: ARSession) {
        guard let anchors = session.currentFrame?.anchors else { return }
        wallCount = anchors.reduce(0) { count, anchor in
            guard let plane = anchor as? ARPlaneAnchor, plane.alignment == .vertical,
                  case .wall = plane.classification else { return count }
            return count + 1
        }
    }

    private func refreshCoverage() {
        guard !refreshing else { return }
        refreshing = true
        coverageModel.refresh { update in
            Task { @MainActor in self.apply(update) }
        }
    }

    private func apply(_ update: CoverageUpdate) {
        refreshing = false
        for id in update.removed {
            overlays.removeValue(forKey: id)?.removeFromParent()
        }
        for mesh in update.meshes {
            var descriptor = MeshDescriptor(name: "coverage")
            descriptor.positions = MeshBuffers.Positions(mesh.positions)
            descriptor.primitives = .triangles(mesh.indices)
            descriptor.materials = .perFace(mesh.faceMaterials)
            guard !mesh.indices.isEmpty, let resource = try? MeshResource.generate(from: [descriptor]) else {
                overlays.removeValue(forKey: mesh.id)?.removeFromParent()
                continue
            }
            if let entity = overlays[mesh.id] {
                entity.model = ModelComponent(mesh: resource, materials: overlayMaterials)
            } else {
                let entity = ModelEntity(mesh: resource, materials: overlayMaterials)
                overlayRoot.addChild(entity)
                overlays[mesh.id] = entity
            }
        }

        coverage = update.coverage
        map.points = update.mapPoints
        map.covered = update.mapCovered
        history.append((photoCount, coverage))
        if history.count > 600 { history.removeFirst(history.count - 600) }
        updateHint()
    }

    // MARK: - Guidance

    private func describe(_ state: ARCamera.TrackingState) {
        switch state {
        case .normal:
            tracking = true
            status = "Tracking"
        case .notAvailable:
            tracking = false
            status = "Tracking unavailable"
            trackingHint = "Hold on, the camera isn't tracking yet."
        case .limited(let reason):
            tracking = false
            switch reason {
            case .initializing:
                status = "Starting up"
                trackingHint = "Move the phone slowly from side to side to get started."
            case .excessiveMotion:
                status = "Moving too fast"
                trackingHint = "Slow down so the phone can keep track of where it is."
            case .insufficientFeatures:
                status = "Not enough detail"
                trackingHint = "Turn on more lights, or aim at something with more texture."
            case .relocalizing:
                status = "Relocalizing"
                trackingHint = "Point back at somewhere you've already scanned."
            @unknown default:
                status = "Tracking limited"
                trackingHint = "Move slowly and keep the room in view."
            }
        }
        updateHint()
    }

    private func updateHint() {
        if isPaused {
            hint = "Paused. Tap play to keep capturing."
        } else if !tracking {
            hint = trackingHint
        } else if frameTime < tooFastUntil {
            hint = "Slow down a little. Quick moves blur the photos."
        } else if photoCount == 0 {
            hint = "Walk slowly around the room. Photos are saved automatically as you move."
        } else if photoCount >= 40,
                  let earlier = history.last(where: { $0.photos <= photoCount - 20 }),
                  coverage - earlier.coverage < 0.01 {
            hint = "Coverage isn't improving much. You can save now, or go after the red patches you missed."
        } else if coverage < 0.7 {
            hint = "Aim at the red areas. Get close to anything you want in detail."
        } else {
            hint = "Photos are saved automatically as you move around the room."
        }
    }
}

extension CaptureController: @preconcurrency ARSessionDelegate {
    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        process(frame)
    }

    func session(_ session: ARSession, didAdd anchors: [ARAnchor]) {
        ingest(anchors, in: session)
    }

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        ingest(anchors, in: session)
    }

    func session(_ session: ARSession, didRemove anchors: [ARAnchor]) {
        for anchor in anchors where anchor is ARMeshAnchor {
            coverageModel.remove(anchor.identifier)
        }
        if anchors.contains(where: { $0 is ARPlaneAnchor }) { countWalls(in: session) }
    }

    func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
        describe(camera.trackingState)
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        status = "AR session failed"
        errorMessage = error.localizedDescription
    }

    func sessionWasInterrupted(_ session: ARSession) {
        status = "Interrupted"
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        status = "Resuming"
    }
}

private func translation(of m: simd_float4x4) -> SIMD3<Float> {
    SIMD3(m.columns.3.x, m.columns.3.y, m.columns.3.z)
}

/// Angle between two cameras' viewing directions (their -Z axes), in radians.
private func viewAngle(_ a: simd_float4x4, _ b: simd_float4x4) -> Float {
    let fa = -SIMD3(a.columns.2.x, a.columns.2.y, a.columns.2.z)
    let fb = -SIMD3(b.columns.2.x, b.columns.2.y, b.columns.2.z)
    return acos(min(1, max(-1, simd_dot(fa, fb))))
}
