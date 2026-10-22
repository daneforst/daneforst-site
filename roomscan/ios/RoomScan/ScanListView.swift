import ARKit
import SwiftUI

struct ScanListView: View {
    @State private var scans: [SavedScan] = []
    @State private var capture: CaptureRequest?
    @State private var shareItem: ShareItem?
    @State private var exporting: URL?
    @State private var alertMessage = ""
    @State private var showingAlert = false
    @AppStorage("hiResPhotos") private var hiResPhotos = false

    private let lidarAvailable = ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
        && ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("RoomScan")
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Menu {
                            Toggle("4K photos", isOn: $hiResPhotos)
                        } label: {
                            Image(systemName: "gearshape")
                        }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(action: startScan) {
                            Label("New scan", systemImage: "plus")
                        }
                        .disabled(!lidarAvailable)
                    }
                }
        }
        .onAppear(perform: reload)
        .fullScreenCover(item: $capture, onDismiss: reload) { request in
            CaptureView(name: request.name)
        }
        .sheet(item: $shareItem) { item in
            ShareSheet(items: [item.url])
        }
        .alert("Couldn't export", isPresented: $showingAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(alertMessage)
        }
    }

    @ViewBuilder private var content: some View {
        if !lidarAvailable {
            ContentUnavailableView(
                "LiDAR needed",
                systemImage: "exclamationmark.triangle",
                description: Text("RoomScan needs an iPhone Pro or iPad Pro with a LiDAR scanner."))
        } else if scans.isEmpty {
            ContentUnavailableView {
                Label("No scans yet", systemImage: "cube.transparent")
            } description: {
                Text("Start a scan and walk slowly around the room. Photos, depth and the phone's position are saved as you go.")
            } actions: {
                Button("New scan", action: startScan)
                    .buttonStyle(.borderedProminent)
            }
        } else {
            List {
                Section {
                    ForEach(scans) { scan in
                        row(scan)
                    }
                    .onDelete(perform: delete)
                } footer: {
                    Text("Share a scan to AirDrop it to your Mac as a .zip. Scans are also in the Files app under On My iPhone › RoomScan.")
                }
            }
        }
    }

    private func row(_ scan: SavedScan) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(scan.name)
                    .font(.headline)
                Text("\(scan.photoCount) photos · \(ByteCountFormatter.string(fromByteCount: scan.byteSize, countStyle: .file)) · \(scan.created.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if exporting == scan.url {
                ProgressView()
            } else {
                Button {
                    export(scan)
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .buttonStyle(.borderless)
                .disabled(exporting != nil)
            }
        }
    }

    private func reload() {
        scans = ScanStore.list()
    }

    private func startScan() {
        capture = CaptureRequest(name: "Room")
    }

    private func delete(_ offsets: IndexSet) {
        for index in offsets {
            try? FileManager.default.removeItem(at: scans[index].url)
        }
        reload()
    }

    private func export(_ scan: SavedScan) {
        exporting = scan.url
        let folder = scan.url
        Task {
            do {
                let zip = try await Task.detached(priority: .userInitiated) { try ScanStore.zip(folder) }.value
                shareItem = ShareItem(url: zip)
            } catch {
                alertMessage = error.localizedDescription
                showingAlert = true
            }
            exporting = nil
        }
    }
}

private struct CaptureRequest: Identifiable {
    let id = UUID()
    let name: String
}

private struct ShareItem: Identifiable {
    let url: URL
    var id: URL { url }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
