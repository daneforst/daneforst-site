import Foundation

/// A saved scan folder in the app's Documents directory.
struct SavedScan: Identifiable, Hashable {
    let url: URL
    let name: String
    let created: Date
    let photoCount: Int
    let byteSize: Int64

    var id: URL { url }
}

enum ScanStore {
    /// Scans live straight in Documents, so they also show up in Files under On My iPhone › RoomScan.
    static var root: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    static func stamp(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd HHmmss"
        return formatter.string(from: date)
    }

    static func folderURL(name: String, stamp: String) -> URL {
        let safe = name.components(separatedBy: CharacterSet(charactersIn: "/:\\"))
            .joined(separator: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return root.appendingPathComponent("\(safe.isEmpty ? "Room" : safe) \(stamp)", isDirectory: true)
    }

    static func list() -> [SavedScan] {
        let folders = (try? FileManager.default.contentsOfDirectory(
            at: root, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles])) ?? []
        return folders.compactMap(load).sorted { $0.created > $1.created }
    }

    /// Zips a scan folder for AirDrop. The system zips anything read with `.forUploading`.
    static func zip(_ folder: URL) throws -> URL {
        var result: Result<URL, Error> = .failure(CocoaError(.fileReadUnknown))
        var coordinatorError: NSError?
        NSFileCoordinator().coordinate(readingItemAt: folder, options: [.forUploading], error: &coordinatorError) { zipped in
            result = Result {
                let destination = FileManager.default.temporaryDirectory
                    .appendingPathComponent(folder.lastPathComponent)
                    .appendingPathExtension("zip")
                try? FileManager.default.removeItem(at: destination)
                try FileManager.default.copyItem(at: zipped, to: destination)
                return destination
            }
        }
        if let coordinatorError { throw coordinatorError }
        return try result.get()
    }

    private struct ManifestSummary: Decodable {
        struct Frame: Decodable {}
        let name: String
        let created: String
        let frames: [Frame]
    }

    private static func load(_ folder: URL) -> SavedScan? {
        guard let data = try? Data(contentsOf: folder.appendingPathComponent("frames.json")),
              let manifest = try? JSONDecoder().decode(ManifestSummary.self, from: data)
        else { return nil }
        return SavedScan(
            url: folder,
            name: manifest.name,
            created: ISO8601DateFormatter().date(from: manifest.created) ?? .distantPast,
            photoCount: manifest.frames.count,
            byteSize: size(of: folder))
    }

    private static func size(of folder: URL) -> Int64 {
        guard let files = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: [.fileSizeKey]) else { return 0 }
        var total: Int64 = 0
        for case let url as URL in files {
            total += Int64((try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
        }
        return total
    }
}
