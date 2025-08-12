# PCB File Editor - Web Version

A modern web-based PCB file editor with netlist parsing capabilities.

## Features

- **Drag & Drop File Loading**: Load .pcb files directly in the browser
- **Full-Screen Debug Console**: Real-time parsing information and debugging
- **Netlist Table View**: Excel-like table display of parsed netlist data
- **Hex Data Viewer**: Raw hex data visualization
- **Cross-Platform**: Works on any modern web browser
- **Responsive Design**: Adapts to different screen sizes

## How to Use

1. Open `index.html` in any modern web browser
2. Click "Open PCB File" to select a .pcb file
3. View real-time parsing information in the debug console
4. Toggle between debug console and netlist table view
5. Use debug controls to analyze file structure

## File Structure

```
web/
├── index.html      # Main HTML structure
├── style.css       # CSS styling (dark theme)
├── script.js       # JavaScript logic and parsing
└── README.md       # This file
```

## Technical Details

### PCB File Format Parsing

The parser follows this structure:
1. First 40 bytes: Header data
2. Bytes 40-43: Netlist start data (4 bytes)
3. Netlist offset = 44 + netlist_start_data
4. Actual netlist = netlist_offset + 32 bytes
5. Netlist structure:
   - Total block size (4 bytes)
   - For each net entry:
     - Single net size (4 bytes)
     - Net index (4 bytes)
     - Net name (remaining bytes)

### Debug Features

- **Show First 50 Bytes**: Display raw hex data for format verification
- **Reparse Netlist**: Re-run parsing with fresh debug output
- **Clear Debug Log**: Reset the debug console
- **Auto-scroll**: Automatically scroll to latest debug messages

### Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Internet Explorer: Not supported (use Edge instead)

## Development

To modify the editor:

1. Edit `style.css` for visual changes
2. Edit `script.js` for functionality changes
3. Edit `index.html` for structure changes

No build process required - just refresh the browser to see changes.

## Advantages over C++ Version

- **No compilation**: Instant testing and deployment
- **Cross-platform**: Works everywhere
- **Better UI**: Modern web technologies
- **Easy debugging**: Browser developer tools
- **Responsive**: Adapts to screen size
- **Extensible**: Easy to add features like search, filtering, export
