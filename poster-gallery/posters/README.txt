POSTER IMAGES
=============

These are the real show posters, resized for the web (long edge capped at
1800px). Each file is referenced by the `image:` path in the `posters` array
near the top of ../index.html.

Adding or swapping a poster
---------------------------
1. Drop the image in this folder. Any vertical proportion works; the gallery
   reads each image's real aspect ratio and fits the plane to it.
2. Add (or edit) an object in the `posters` array in index.html with the
   matching `image:` path and the show details.

What the gallery reads from each entry
--------------------------------------
- artist, support[], venue, city, date, note  -> shown on the detail page
- dimensions, technique, edition, colors, year -> the small mono credit block

`support` and `note` are optional. Any credit field left out is simply hidden,
so a promo poster with just a name still renders cleanly. The print-production
details (technique, edition, color count, dimensions) are NOT printed on the
artwork, so fill those in by hand where you want them to show.
