import RealityKit
import SwiftUI
import simd

struct CaptureView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var controller: CaptureController
    @State private var confirmingClose = false
    @State private var renaming = false
    @State private var draftName = ""
    @State private var showingError = false

    init(name: String) {
        _controller = StateObject(wrappedValue: CaptureController(name: name))
    }

    var body: some View {
        ZStack {
            ARViewContainer(controller: controller)
                .ignoresSafeArea()

            VStack(spacing: 12) {
                HStack(alignment: .top) {
                    closeButton
                    Spacer()
                    VStack(alignment: .trailing, spacing: 10) {
                        statusPanel
                        MiniMap(map: controller.map)
                            .frame(width: 132, height: 132)
                    }
                }
                Spacer()
                Text(controller.hint)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .animation(.default, value: controller.hint)
                controls
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)

            if controller.isSaving {
                Color.black.opacity(0.35).ignoresSafeArea()
                ProgressView("Saving room…")
                    .padding(24)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
        .statusBarHidden()
        .onDisappear { controller.stop() }
        .onChange(of: controller.isFinished) { _, finished in
            if finished { dismiss() }
        }
        .onChange(of: controller.errorMessage) { _, message in
            showingError = message != nil
        }
        .confirmationDialog("Done scanning?", isPresented: $confirmingClose, titleVisibility: .visible) {
            Button("Save room") { controller.save() }
            Button("Discard scan", role: .destructive) { controller.discard() }
            Button("Keep scanning", role: .cancel) {}
        }
        .alert("Rename scan", isPresented: $renaming) {
            TextField("Name", text: $draftName)
            Button("Rename") {
                let name = draftName.trimmingCharacters(in: .whitespacesAndNewlines)
                if !name.isEmpty { controller.name = name }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Something went wrong", isPresented: $showingError) {
            Button("OK", role: .cancel) { controller.errorMessage = nil }
        } message: {
            Text(controller.errorMessage ?? "")
        }
    }

    private var closeButton: some View {
        Button {
            if controller.photoCount == 0 { controller.discard() } else { confirmingClose = true }
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 16, weight: .semibold))
                .frame(width: 40, height: 40)
                .background(.regularMaterial, in: Circle())
        }
        .foregroundStyle(.primary)
    }

    private var statusPanel: some View {
        HStack(spacing: 12) {
            CoverageRing(value: controller.coverage)
                .frame(width: 52, height: 52)
            VStack(alignment: .trailing, spacing: 2) {
                Button {
                    draftName = controller.name
                    renaming = true
                } label: {
                    Text(controller.name)
                        .font(.headline)
                        .lineLimit(1)
                }
                .foregroundStyle(.primary)
                Text("\(controller.wallCount) \(controller.wallCount == 1 ? "wall" : "walls") · \(controller.photoCount) photos")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(controller.status)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var controls: some View {
        HStack(alignment: .center) {
            Legend()
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 14) {
                Button { controller.togglePause() } label: {
                    Image(systemName: controller.isPaused ? "play.fill" : "pause.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .frame(width: 40, height: 40)
                        .background(.regularMaterial, in: Circle())
                }
                .foregroundStyle(.primary)
                Button { controller.captureNow() } label: {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.black)
                        .frame(width: 66, height: 66)
                        .background(.white, in: Circle())
                        .overlay(Circle().stroke(.black.opacity(0.15), lineWidth: 1))
                }
            }
            Button("Save room") { controller.save() }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(controller.photoCount == 0 || controller.isSaving)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }
}

struct ARViewContainer: UIViewRepresentable {
    let controller: CaptureController

    func makeUIView(context: Context) -> ARView {
        let view = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
        controller.attach(to: view)
        return view
    }

    func updateUIView(_ view: ARView, context: Context) {}
}

/// "Photo detail" ring: share of the room's surface photographed from close enough to be useful.
struct CoverageRing: View {
    let value: Double

    var body: some View {
        ZStack {
            Circle().stroke(Color.primary.opacity(0.12), lineWidth: 5)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, value)))
                .stroke(tint, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(Int((value * 100).rounded()))%")
                    .font(.system(size: 13, weight: .semibold))
                    .monospacedDigit()
                Text("detail")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
            }
        }
        .animation(.easeOut(duration: 0.4), value: value)
    }

    private var tint: Color {
        value >= 0.8 ? Color(uiColor: Palette.captured) : .orange
    }
}

private struct Legend: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            item(Color(uiColor: Palette.missing), "needs photos")
            item(Color(uiColor: Palette.captured), "captured")
        }
        .font(.caption2)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func item(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text)
        }
    }
}

/// Top-down dots of the room's surfaces (red still needs photos, green is done) and an arrow for the phone.
struct MiniMap: View {
    let map: CoverageMap

    var body: some View {
        Canvas { context, size in
            var lo = map.camera
            var hi = map.camera
            for p in map.points {
                lo = simd_min(lo, p)
                hi = simd_max(hi, p)
            }
            let span = max(hi.x - lo.x, hi.y - lo.y, 1)
            let scale = (min(size.width, size.height) - 20) / CGFloat(span)
            let mid = (lo + hi) / 2
            func place(_ p: SIMD2<Float>) -> CGPoint {
                CGPoint(x: size.width / 2 + CGFloat(p.x - mid.x) * scale,
                        y: size.height / 2 + CGFloat(p.y - mid.y) * scale)
            }

            var seen = Path()
            var missing = Path()
            for (i, p) in map.points.enumerated() where i < map.covered.count {
                let c = place(p)
                let dot = CGRect(x: c.x - 1.2, y: c.y - 1.2, width: 2.4, height: 2.4)
                if map.covered[i] { seen.addRect(dot) } else { missing.addRect(dot) }
            }
            context.fill(missing, with: .color(Color(uiColor: Palette.missing)))
            context.fill(seen, with: .color(Color(uiColor: Palette.captured)))

            let c = place(map.camera)
            let h = CGPoint(x: CGFloat(map.heading.x), y: CGFloat(map.heading.y))
            let side = CGPoint(x: -h.y, y: h.x)
            var arrow = Path()
            arrow.move(to: CGPoint(x: c.x + h.x * 9, y: c.y + h.y * 9))
            arrow.addLine(to: CGPoint(x: c.x - h.x * 5 + side.x * 5, y: c.y - h.y * 5 + side.y * 5))
            arrow.addLine(to: CGPoint(x: c.x - h.x * 5 - side.x * 5, y: c.y - h.y * 5 - side.y * 5))
            arrow.closeSubpath()
            context.fill(arrow, with: .color(.white))
            context.stroke(arrow, with: .color(.black.opacity(0.6)), lineWidth: 1)
        }
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
