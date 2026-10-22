import ARKit
import Metal
import simd

/// One ARKit mesh anchor, baked into world space.
struct MeshChunk {
    let id: UUID
    let positions: [SIMD3<Float>]
    let indices: [UInt32]

    init(_ anchor: ARMeshAnchor) {
        id = anchor.identifier
        let geometry = anchor.geometry
        let transform = anchor.transform

        let vertices = geometry.vertices
        let vertexBase = vertices.buffer.contents()
        var positions = [SIMD3<Float>]()
        positions.reserveCapacity(vertices.count)
        for i in 0..<vertices.count {
            let p = vertexBase.advanced(by: vertices.offset + vertices.stride * i).assumingMemoryBound(to: Float.self)
            let world = transform * SIMD4<Float>(p[0], p[1], p[2], 1)
            positions.append(SIMD3(world.x, world.y, world.z))
        }
        self.positions = positions

        let faces = geometry.faces
        let indexCount = faces.count * faces.indexCountPerPrimitive
        let faceBase = faces.buffer.contents()
        var indices = [UInt32]()
        indices.reserveCapacity(indexCount)
        if faces.bytesPerIndex == MemoryLayout<UInt16>.size {
            let p = faceBase.assumingMemoryBound(to: UInt16.self)
            for i in 0..<indexCount { indices.append(UInt32(p[i])) }
        } else {
            let p = faceBase.assumingMemoryBound(to: UInt32.self)
            for i in 0..<indexCount { indices.append(p[i]) }
        }
        self.indices = indices
    }
}

/// What the overlay and the HUD need after a coverage pass.
struct CoverageUpdate {
    struct Mesh {
        let id: UUID
        let positions: [SIMD3<Float>]
        let indices: [UInt32]
        /// Per triangle: 0 = photographed up close, 1 = still needs photos.
        let faceMaterials: [UInt32]
    }

    var meshes: [Mesh] = []
    var removed: [UUID] = []
    var coverage = 0.0
    var mapPoints: [SIMD2<Float>] = []
    var mapCovered: [Bool] = []
}

/// Tracks which parts of the room have been photographed up close.
///
/// Every saved photo's depth map is projected into the world and dropped into a 5 cm voxel set.
/// A mesh triangle counts as captured when its center lands in one of those voxels. Voxels rather
/// than per-vertex flags, because ARKit keeps rebuilding the mesh and vertex indices don't survive that.
final class CoverageModel: @unchecked Sendable {
    /// Surfaces farther than this from the camera don't count as photographed in detail.
    static let detailDistance: Float = 3.0

    private let voxelSize: Float = 0.05
    private let queue = DispatchQueue(label: "roomscan.coverage", qos: .userInitiated)

    private var voxels = Set<SIMD3<Int32>>()
    private var chunks: [UUID: MeshChunk] = [:]
    private var states: [UUID: ChunkState] = [:]
    private var dirty = Set<UUID>()
    private var reshaped = Set<UUID>()
    private var removed = Set<UUID>()

    private struct ChunkState {
        var faceMaterials: [UInt32] = []
        var area: Float = 0
        var coveredArea: Float = 0
        var mapPoints: [SIMD2<Float>] = []
        var mapCovered: [Bool] = []
    }

    func update(_ chunk: MeshChunk) {
        queue.async { [self] in
            chunks[chunk.id] = chunk
            removed.remove(chunk.id)
            dirty.insert(chunk.id)
            reshaped.insert(chunk.id)
        }
    }

    func remove(_ id: UUID) {
        queue.async { [self] in
            chunks[id] = nil
            states[id] = nil
            dirty.remove(id)
            reshaped.remove(id)
            removed.insert(id)
        }
    }

    /// Marks the surfaces a saved photo saw up close.
    func addPhoto(_ shot: FrameCapture) {
        queue.async { [self] in
            let depth = shot.depth
            let confidence = shot.confidence.flatMap { $0.values.count == depth.values.count ? $0 : nil }
            let k = shot.intrinsics
            let sx = Float(depth.width) / Float(shot.imageSize.width)
            let sy = Float(depth.height) / Float(shot.imageSize.height)
            let fx = k.columns.0.x * sx, fy = k.columns.1.y * sy
            let cx = k.columns.2.x * sx, cy = k.columns.2.y * sy

            var grew = false
            for v in stride(from: 0, to: depth.height, by: 3) {
                for u in stride(from: 0, to: depth.width, by: 3) {
                    let i = v * depth.width + u
                    if let confidence, confidence.values[i] < 2 { continue }
                    let d = depth.values[i]
                    guard d > 0.1, d < Self.detailDistance else { continue }
                    let x = (Float(u) - cx) / fx * d
                    let y = (Float(v) - cy) / fy * d
                    let world = shot.transform * SIMD4<Float>(x, -y, -d, 1)
                    if voxels.insert(key(SIMD3(world.x, world.y, world.z))).inserted { grew = true }
                }
            }
            if grew { dirty.formUnion(chunks.keys) }
        }
    }

    /// Re-shades the chunks that changed and reports overall coverage.
    func refresh(completion: @escaping @Sendable (CoverageUpdate) -> Void) {
        queue.async { [self] in
            var update = CoverageUpdate()
            for id in dirty {
                guard let chunk = chunks[id] else { continue }
                let state = shade(chunk)
                let changed = reshaped.contains(id) || states[id]?.faceMaterials != state.faceMaterials
                states[id] = state
                if changed {
                    update.meshes.append(.init(id: id, positions: chunk.positions, indices: chunk.indices,
                                               faceMaterials: state.faceMaterials))
                }
            }
            dirty.removeAll()
            reshaped.removeAll()
            update.removed = Array(removed)
            removed.removeAll()

            var area: Float = 0
            var covered: Float = 0
            var points: [SIMD2<Float>] = []
            var flags: [Bool] = []
            for state in states.values {
                area += state.area
                covered += state.coveredArea
                points += state.mapPoints
                flags += state.mapCovered
            }
            update.coverage = area > 0 ? Double(covered / area) : 0

            // The mini map only needs a few thousand dots.
            let step = max(1, points.count / 2500)
            update.mapPoints = stride(from: 0, to: points.count, by: step).map { points[$0] }
            update.mapCovered = stride(from: 0, to: flags.count, by: step).map { flags[$0] }
            completion(update)
        }
    }

    func snapshot(completion: @escaping @Sendable ([MeshChunk]) -> Void) {
        queue.async { [self] in completion(Array(chunks.values)) }
    }

    private func shade(_ chunk: MeshChunk) -> ChunkState {
        let p = chunk.positions
        let faceCount = chunk.indices.count / 3
        var state = ChunkState()
        state.faceMaterials = [UInt32](repeating: 1, count: faceCount)
        for f in 0..<faceCount {
            let ia = Int(chunk.indices[3 * f]), ib = Int(chunk.indices[3 * f + 1]), ic = Int(chunk.indices[3 * f + 2])
            guard ia < p.count, ib < p.count, ic < p.count else { continue }
            let a = p[ia], b = p[ib], c = p[ic]
            let area = simd_length(simd_cross(b - a, c - a)) * 0.5
            let center = (a + b + c) / 3
            let seen = voxels.contains(key(center))
            state.area += area
            if seen {
                state.coveredArea += area
                state.faceMaterials[f] = 0
            }
            if f % 6 == 0 {
                state.mapPoints.append(SIMD2(center.x, center.z))
                state.mapCovered.append(seen)
            }
        }
        return state
    }

    private func key(_ p: SIMD3<Float>) -> SIMD3<Int32> {
        let q = (p / voxelSize).rounded(.down)
        return SIMD3<Int32>(Int32(q.x), Int32(q.y), Int32(q.z))
    }
}
