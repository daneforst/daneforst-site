GALLERIES: POSTER STILLS (optional but recommended)
===================================================

Each gallery <video> references a matching .jpg "poster": the still frame shown
before the clip loads (and the tile/hero fallback if a browser can't play video).
They are optional. Without them the pages simply show a clean dark panel until the
clip plays. With them, previews look finished and there are no 404s in the console.

Export one JPG per clip (a representative frame, same pixel size as the clip),
using the SAME base name as the video, into these subfolders:

album-art/     album-art-teaser.jpg  album-art-01.jpg  album-art-02.jpg  album-art-03.jpg
key-art/       key-art-teaser.jpg    key-art-01.jpg    key-art-02.jpg    key-art-03.jpg
show-posters/  show-posters-teaser.jpg  show-posters-01.jpg  show-posters-02.jpg  show-posters-03.jpg

If you decide NOT to use posters, you can delete the poster="..." attribute from
the <video> tags to silence the 404s, but leaving them costs nothing.
