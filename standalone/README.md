# Niagara Lite Effect Lab 001

Open `index.html` in a modern desktop or mobile browser. No server, packages, or internet connection required.

Controls: choose Boost Burst, Rail Sparks, or Portal Pulse; adjust count, speed, lifetime, and color; replay; export JSON or a 4x4 PNG flipbook.

## UEFN handoff

The exported PNG is a 1024x1024 4x4 atlas, 16 frames, 256px each. Import as a texture in UEFN. Create a Niagara sprite emitter using a SubUV/flipbook-capable material and set the grid to 4 columns and 4 rows, with animation progressing over particle lifetime. Use additive or translucent blending as appropriate. For a fully real-time version, build a basic Niagara sprite emitter using spawn burst, particle lifetime, initial velocity, and color/size over life. Add an optional simple ring mesh or sprite emitter.

The JSON is a descriptive schema for a future template-mapping Python importer. It cannot be directly imported as a Niagara system. Verify UEFN's available editor scripting features before automating asset construction.

This prototype intentionally tests visual quality and a portable effect definition before attempting UEFN automation.
