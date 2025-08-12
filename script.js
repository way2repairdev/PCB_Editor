// PCB File Editor JavaScript
class PCBFileEditor {
    constructor() {
        this.fileData = null;
        this.fileName = '';
        this.fileSize = 0;
        this.netlist = [];
        this.netlistStartOffset = 0;
        this.netlistTotalSize = 0;
        this.debugLog = [];
        
        this.initializeUI();
    }

    initializeUI() {
        // Get DOM elements
        this.openFileBtn = document.getElementById('openFileBtn');
        this.fileInput = document.getElementById('fileInput');
        this.saveFileBtn = document.getElementById('saveFileBtn');
        this.debugToggle = document.getElementById('debugToggle');
        this.fileInfo = document.getElementById('fileInfo');
        this.debugView = document.getElementById('debugView');
        this.regularView = document.getElementById('regularView');
        this.debugConsole = document.getElementById('debugConsole');
        this.clearLogBtn = document.getElementById('clearLogBtn');
        this.showBytesBtn = document.getElementById('showBytesBtn');
        this.reparseBtn = document.getElementById('reparseBtn');
        this.netlistBody = document.getElementById('netlistBody');
        this.hexViewer = document.getElementById('hexViewer');
        this.netlistOffset = document.getElementById('netlistOffset');
        this.netlistSize = document.getElementById('netlistSize');

        // Event listeners
        this.openFileBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.saveFileBtn.addEventListener('click', () => this.saveFile());
        this.debugToggle.addEventListener('change', () => this.toggleView());
        this.clearLogBtn.addEventListener('click', () => this.clearDebugLog());
        this.showBytesBtn.addEventListener('click', () => this.showFirstBytes());
        this.reparseBtn.addEventListener('click', () => this.reparseNetlist());

        // Initial state
        this.toggleView();
    }

    addDebugLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        this.debugLog.push(logEntry);
        
        // Keep only last 100 messages
        if (this.debugLog.length > 100) {
            this.debugLog.shift();
        }
        
        // Add to console
        const messageDiv = document.createElement('div');
        messageDiv.className = `debug-message ${type}`;
        messageDiv.textContent = logEntry;
        this.debugConsole.appendChild(messageDiv);
        
        // Auto-scroll to bottom
        this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
    }

    clearDebugLog() {
        this.debugLog = [];
        this.debugConsole.innerHTML = '<div class="debug-message">Debug log cleared.</div>';
    }

    toggleView() {
        const showDebug = this.debugToggle.checked;
        this.debugView.style.display = showDebug ? 'flex' : 'none';
        this.regularView.style.display = showDebug ? 'none' : 'block';
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.fileName = file.name;
        this.fileSize = file.size;
        
        this.addDebugLog(`Loading file: ${this.fileName}`, 'info');
        this.addDebugLog(`File size: ${this.fileSize} bytes`, 'info');

        try {
            const arrayBuffer = await file.arrayBuffer();
            this.fileData = new Uint8Array(arrayBuffer);
            
            this.addDebugLog(`Bytes read: ${this.fileData.length}`, 'info');
            this.updateFileInfo();
            
            if (this.fileData.length > 0) {
                this.addDebugLog('File loaded successfully, starting netlist parsing...', 'info');
                this.parseNetlist();
                // Enable save button once file is loaded (for testing)
                this.saveFileBtn.disabled = false;
                this.addDebugLog('Save button enabled for testing', 'info');
            } else {
                this.addDebugLog('Error: File loading failed', 'error');
            }
        } catch (error) {
            this.addDebugLog(`Error loading file: ${error.message}`, 'error');
        }
    }

    updateFileInfo() {
        this.fileInfo.textContent = `| File: ${this.fileName} | Size: ${this.fileSize} bytes | Nets: ${this.netlist.length}`;
    }

    readUInt32LE(data, offset) {
        if (offset + 4 > data.length) return 0;
        return data[offset] | 
               (data[offset + 1] << 8) | 
               (data[offset + 2] << 16) | 
               (data[offset + 3] << 24);
    }

    // Helper function to check for end pattern
    checkEndPattern(data, offset) {
        const endPattern = [0x76, 0x36, 0x76, 0x36, 0x35, 0x35, 0x35, 0x76, 0x36, 0x76, 0x36];
        
        if (offset + endPattern.length > data.length) return false;
        
        for (let i = 0; i < endPattern.length; i++) {
            if (data[offset + i] !== endPattern[i]) {
                return false;
            }
        }
        return true;
    }

    parseNetlist() {
        this.netlist = [];
        this.addDebugLog('Starting netlist parsing...', 'info');
        
        if (this.fileData.length < 44) {
            this.addDebugLog(`Error: File too small (< 44 bytes). Size: ${this.fileData.length}`, 'error');
            return;
        }
        
        // Get netlist start data (4 bytes after first 40 bytes)
        const netlistStartData = this.readUInt32LE(this.fileData, 40);
        this.addDebugLog(`Netlist Start Data (offset 40): ${netlistStartData} (0x${netlistStartData.toString(16)})`, 'info');
        
        this.netlistStartOffset = 0 + netlistStartData; // 40 + 4 + netlistStartData
        this.addDebugLog(`Calculated netlist start offset: ${this.netlistStartOffset}`, 'info');
        
        if (this.netlistStartOffset + 32 >= this.fileData.length) {
            this.addDebugLog('Error: Netlist start offset + 32 exceeds file size', 'error');
            return;
        }
        
        // Actual netlist data starts 32 bytes after netlist start offset
        const netlistDataStart = this.netlistStartOffset + 32;
        this.addDebugLog(`Netlist data starts at offset: ${netlistDataStart}`, 'info');
        
        if (netlistDataStart >= this.fileData.length) {
            this.addDebugLog('Error: Netlist data start exceeds file size', 'error');
            return;
        }
        
        // Read total netlist block size (first 4 bytes of netlist data)
        this.netlistTotalSize = this.readUInt32LE(this.fileData, netlistDataStart);
        this.addDebugLog(`Total netlist block size: ${this.netlistTotalSize} bytes`, 'info');
        
        let currentOffset = netlistDataStart + 4; // Skip total size
        const endOffset = netlistDataStart + this.netlistTotalSize;
        this.addDebugLog(`Parsing entries from offset ${currentOffset} to ${endOffset}`, 'info');
        
        // Parse individual netlist entries until end pattern is found
        let entryCount = 0;
        while (currentOffset + 8 < this.fileData.length) {
            // Check for end pattern first
            if (this.checkEndPattern(this.fileData, currentOffset)) {
                this.addDebugLog(`Found end pattern at offset ${currentOffset}: 76 36 76 36 35 35 35 76 36 76 36`, 'info');
                break;
            }
            
            // Also check if we've exceeded the max end offset as a safety measure
            if (currentOffset >= endOffset) {
                this.addDebugLog(`Reached max end offset ${endOffset}, stopping parsing`, 'info');
                break;
            }
            
            // Read single netlist data size (4 bytes)
            const singleNetSize = this.readUInt32LE(this.fileData, currentOffset);
            this.addDebugLog(`Entry ${entryCount} - Single net size: ${singleNetSize} at offset ${currentOffset}`, 'info');
            
            // Validate single net size
            if (singleNetSize < 8 || singleNetSize > 1000) { // minimum 8 bytes (4 for index + at least 4 for name)
                this.addDebugLog(`Error: Invalid single net size ${singleNetSize}`, 'error');
                break;
            }
            
            if (currentOffset + singleNetSize > this.fileData.length) {
                this.addDebugLog('Error: Single net size exceeds file boundary', 'error');
                break;
            }
            
            currentOffset += 4;
            
            // Read net index (4 bytes)
            const netIndex = this.readUInt32LE(this.fileData, currentOffset);
            this.addDebugLog(`Entry ${entryCount} - Net index: ${netIndex}`, 'info');
            currentOffset += 4;
            
            // Read net name (remaining bytes from single net size)
            const nameSize = singleNetSize - 8; // Subtract 8 bytes (4 for size field + 4 for net index)
            let netName = '';
            
            if (nameSize > 0 && currentOffset + nameSize <= this.fileData.length) {
                const nameBytes = this.fileData.slice(currentOffset, currentOffset + nameSize);
                
                // Try to decode as text, handling different encodings
                try {
                    netName = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(nameBytes);
                } catch {
                    // Fallback to ASCII if UTF-8 fails
                    netName = String.fromCharCode(...nameBytes.filter(b => b > 0 && b < 128));
                }
                
                // Remove only null terminators and control characters (but keep spaces)
                netName = netName.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
                
                this.addDebugLog(`Entry ${entryCount} - Net name: '${netName}' (${nameSize} bytes)`, 'info');
            }
            
            currentOffset += nameSize;
            
            // Log the next few bytes to help diagnose the parsing
            if (currentOffset < this.fileData.length - 8) {
                const nextBytes = Array.from(this.fileData.slice(currentOffset, currentOffset + 8))
                    .map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
                this.addDebugLog(`Next 8 bytes after net name: ${nextBytes}`, 'debug');
            }
            
            // Add to netlist (only if we have a valid name)
            if (netName.length > 0) {
                this.netlist.push({
                    netIndex: netIndex,
                    netName: netName,
                    netSize: singleNetSize
                });
            }
            entryCount++;
            
            // Safety check to prevent infinite loops
            if (entryCount > 10000) {
                this.addDebugLog('Warning: Reached 10000 entries, stopping to prevent infinite loop', 'warning');
                break;
            }
        }
        
        this.addDebugLog(`Parsing completed. Total entries parsed: ${entryCount}`, 'info');
        this.addDebugLog(`Valid netlist entries: ${this.netlist.length}`, 'info');
        
        // Update UI
        this.updateFileInfo();
        this.updateNetlistTable();
        this.updateFileDetails();
        this.updateHexViewer();
    }

    updateNetlistTable() {
        this.netlistBody.innerHTML = '';
        
        this.netlist.forEach((entry, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.netIndex}</td>
                <td class="net-name-cell" data-index="${index}">
                    <span class="net-name-display">${entry.netName}</span>
                    <input class="net-name-input" type="text" value="${entry.netName}" style="display: none;">
                </td>
                <td>${entry.netSize} bytes</td>
                <td>
                    <button class="btn-edit" onclick="pcbEditor.editNetName(${index})">Edit</button>
                    <button class="btn-edit save-btn" onclick="pcbEditor.saveNetName(${index})" style="display: none;">Save</button>
                    <button class="btn-edit cancel-btn" onclick="pcbEditor.cancelEdit(${index})" style="display: none;">Cancel</button>
                </td>
            `;
            this.netlistBody.appendChild(row);
        });
    }

    updateFileDetails() {
        this.netlistOffset.textContent = `Netlist Start Offset: ${this.netlistStartOffset}`;
        this.netlistSize.textContent = `Netlist Total Size: ${this.netlistTotalSize} bytes`;
    }

    updateHexViewer() {
        if (!this.fileData) return;
        
        this.hexViewer.innerHTML = '';
        
        // Show first 256 bytes in hex format
        const maxBytes = Math.min(256, this.fileData.length);
        
        for (let i = 0; i < maxBytes; i += 16) {
            const line = document.createElement('div');
            line.className = 'hex-line';
            
            // Address
            const address = document.createElement('span');
            address.className = 'hex-address';
            address.textContent = i.toString(16).padStart(8, '0').toUpperCase() + ':';
            line.appendChild(address);
            
            // Hex bytes
            const hexBytes = document.createElement('span');
            hexBytes.className = 'hex-bytes';
            let hexString = '';
            let asciiString = '';
            
            for (let j = 0; j < 16 && (i + j) < maxBytes; j++) {
                const byte = this.fileData[i + j];
                hexString += byte.toString(16).padStart(2, '0').toUpperCase() + ' ';
                asciiString += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
            }
            
            hexBytes.textContent = hexString.padEnd(48, ' ');
            line.appendChild(hexBytes);
            
            // ASCII
            const ascii = document.createElement('span');
            ascii.className = 'hex-ascii';
            ascii.textContent = '|' + asciiString + '|';
            line.appendChild(ascii);
            
            this.hexViewer.appendChild(line);
        }
    }

    showFirstBytes() {
        if (!this.fileData) {
            this.addDebugLog('No file loaded!', 'warning');
            return;
        }
        
        this.addDebugLog('=== First 50 bytes of file ===', 'info');
        
        const maxBytes = Math.min(50, this.fileData.length);
        for (let i = 0; i < maxBytes; i += 16) {
            let line = `Offset ${i}: `;
            for (let j = 0; j < 16 && (i + j) < maxBytes; j++) {
                line += this.fileData[i + j].toString(16).padStart(2, '0').toUpperCase() + ' ';
            }
            this.addDebugLog(line, 'info');
        }
        
        this.addDebugLog('=== End of first 50 bytes ===', 'info');
    }

    showBytesAtOffset(offset, count = 32) {
        if (!this.fileData) {
            this.addDebugLog('No file loaded!', 'warning');
            return;
        }
        
        this.addDebugLog(`=== ${count} bytes starting at offset ${offset} ===`, 'info');
        
        const maxBytes = Math.min(count, this.fileData.length - offset);
        for (let i = 0; i < maxBytes; i += 16) {
            let line = `Offset ${offset + i}: `;
            for (let j = 0; j < 16 && (i + j) < maxBytes; j++) {
                line += this.fileData[offset + i + j].toString(16).padStart(2, '0').toUpperCase() + ' ';
            }
            this.addDebugLog(line, 'info');
        }
        
        this.addDebugLog(`=== End of ${count} bytes ===`, 'info');
    }

    reparseNetlist() {
        if (!this.fileData) {
            this.addDebugLog('No file loaded!', 'warning');
            return;
        }
        
        this.addDebugLog('=== Reparsing netlist ===', 'info');
        this.parseNetlist();
    }

    editNetName(index) {
        const cell = document.querySelector(`[data-index="${index}"]`);
        const display = cell.querySelector('.net-name-display');
        const input = cell.querySelector('.net-name-input');
        const editBtn = cell.parentElement.querySelector('.btn-edit:not(.save-btn):not(.cancel-btn)');
        const saveBtn = cell.parentElement.querySelector('.save-btn');
        const cancelBtn = cell.parentElement.querySelector('.cancel-btn');

        display.style.display = 'none';
        input.style.display = 'inline-block';
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
        
        input.focus();
        input.select();
    }

    saveNetName(index) {
        const cell = document.querySelector(`[data-index="${index}"]`);
        const display = cell.querySelector('.net-name-display');
        const input = cell.querySelector('.net-name-input');
        const newName = input.value; // Don't trim - preserve spaces

        if (newName === '') {
            this.addDebugLog('Net name cannot be empty!', 'error');
            return;
        }

        // Update the netlist data
        const oldName = this.netlist[index].netName;
        this.netlist[index].netName = newName;
        
        // Calculate new size: NET SIZE BYTE (4) + NET INDEX BYTE (4) + NET NAME BYTES
        const newNetSize = 4 + 4 + newName.length; // size field + index field + name bytes
        const oldNetSize = this.netlist[index].netSize;
        this.netlist[index].netSize = newNetSize;

        this.addDebugLog(`Net name changed from "${oldName}" to "${newName}"`, 'info');
        this.addDebugLog(`Net size changed from ${oldNetSize} to ${newNetSize} bytes`, 'info');
        
        // Enable save button
        this.saveFileBtn.disabled = false;
        
        this.cancelEdit(index);
        this.updateNetlistTable();
        this.updateFileDetails();
    }

    cancelEdit(index) {
        const cell = document.querySelector(`[data-index="${index}"]`);
        const display = cell.querySelector('.net-name-display');
        const input = cell.querySelector('.net-name-input');
        const editBtn = cell.parentElement.querySelector('.btn-edit:not(.save-btn):not(.cancel-btn)');
        const saveBtn = cell.parentElement.querySelector('.save-btn');
        const cancelBtn = cell.parentElement.querySelector('.cancel-btn');

        // Reset input to original value
        input.value = this.netlist[index].netName;

        display.style.display = 'inline-block';
        input.style.display = 'none';
        editBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    }

    saveFile() {
        this.addDebugLog('Save button clicked!', 'info');
        
        if (!this.fileData) {
            this.addDebugLog('No file loaded to save!', 'error');
            return;
        }

        if (this.saveFileBtn.disabled) {
            this.addDebugLog('Save button is disabled!', 'warning');
            return;
        }

        this.addDebugLog('=== Starting file save process ===', 'info');
        
        try {
            // Create a copy of the original file data
            let newFileData = new Uint8Array(this.fileData);
            this.addDebugLog(`Original file size: ${this.fileData.length} bytes`, 'info');
            
            // Rebuild the netlist section
            newFileData = this.rebuildNetlistData(newFileData);
            
            this.addDebugLog(`Final file size: ${newFileData.length} bytes`, 'info');
            
            // Create download link
            const blob = new Blob([newFileData], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.fileName || 'modified.pcb';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.addDebugLog('File saved successfully!', 'info');
            this.saveFileBtn.disabled = true;
            
        } catch (error) {
            this.addDebugLog(`Error saving file: ${error.message}`, 'error');
        }
    }

    rebuildNetlistData(fileData) {
        this.addDebugLog('Rebuilding netlist data...', 'info');
        
        // Calculate new netlist data
        let netlistData = new Uint8Array();
        let totalNetlistSize = 4; // Start with 4 bytes for total size
        
        // Build each net entry
        for (const net of this.netlist) {
            const nameBytes = new TextEncoder().encode(net.netName);
            // NET SIZE = NET SIZE BYTE (4) + NET INDEX BYTE (4) + NET NAME BYTES
            const netSize = 4 + 4 + nameBytes.length;
            const entrySize = netSize; // The net size already includes the size field itself
            
            const entryData = new Uint8Array(entrySize);
            let offset = 0;
            
            // Write net size (4 bytes) - includes size field + index field + name bytes
            const sizeBytes = new Uint32Array([netSize]);
            const sizeBytesArray = new Uint8Array(sizeBytes.buffer);
            entryData.set(sizeBytesArray, offset);
            offset += 4;
            
            // Write net index (4 bytes)
            const indexBytes = new Uint32Array([net.netIndex]);
            const indexBytesArray = new Uint8Array(indexBytes.buffer);
            entryData.set(indexBytesArray, offset);
            offset += 4;
            
            // Write net name
            entryData.set(nameBytes, offset);
            
            // Append to netlist data
            const newNetlistData = new Uint8Array(netlistData.length + entryData.length);
            newNetlistData.set(netlistData);
            newNetlistData.set(entryData, netlistData.length);
            netlistData = newNetlistData;
            
            totalNetlistSize += entrySize;
            
            this.addDebugLog(`Net "${net.netName}": size=${netSize}, entry_size=${entrySize}`, 'debug');
        }
        
        this.addDebugLog(`Total new netlist size: ${totalNetlistSize} bytes`, 'info');
        this.addDebugLog(`Original netlist size: ${this.netlistTotalSize} bytes`, 'info');
        
        // Get netlist data start position
        const netlistDataStart = this.netlistStartOffset + 32;
        const originalNetlistEnd = netlistDataStart + this.netlistTotalSize;
        this.addDebugLog(`Netlist data starts at offset: ${netlistDataStart}`, 'info');
        this.addDebugLog(`Original netlist ends at offset: ${originalNetlistEnd}`, 'info');
        
        // Calculate size difference
        const sizeDifference = totalNetlistSize - this.netlistTotalSize;
        this.addDebugLog(`Size difference: ${sizeDifference} bytes`, 'info');
        
        // Create new file with adjusted size
        const newFileSize = fileData.length + sizeDifference;
        this.addDebugLog(`New file size will be: ${newFileSize} bytes (was ${fileData.length})`, 'info');
        
        const newFileData = new Uint8Array(Math.max(newFileSize, netlistDataStart + totalNetlistSize));
        
        // Copy everything before the netlist data
        newFileData.set(fileData.slice(0, netlistDataStart));
        this.addDebugLog(`Copied ${netlistDataStart} bytes before netlist`, 'info');
        
        // Update total netlist size in the file
        const totalSizeBytes = new Uint32Array([totalNetlistSize]);
        const totalSizeBytesArray = new Uint8Array(totalSizeBytes.buffer);
        newFileData.set(totalSizeBytesArray, netlistDataStart);
        
        // Insert new netlist data
        newFileData.set(netlistData, netlistDataStart + 4);
        this.addDebugLog(`Inserted ${netlistData.length} bytes of netlist data`, 'info');
        
        // Copy everything after the original netlist data (if any)
        if (originalNetlistEnd < fileData.length) {
            const remainingData = fileData.slice(originalNetlistEnd);
            const newOffset = netlistDataStart + totalNetlistSize;
            newFileData.set(remainingData, newOffset);
            this.addDebugLog(`Copied ${remainingData.length} bytes after netlist to offset ${newOffset}`, 'info');
        }
        
        // Update our internal size tracking
        this.netlistTotalSize = totalNetlistSize;
        
        this.addDebugLog(`Netlist rebuilt with ${this.netlist.length} entries, total size: ${totalNetlistSize} bytes`, 'info');
        this.addDebugLog(`Final file size: ${newFileData.length} bytes`, 'info');
        
        return newFileData;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pcbEditor = new PCBFileEditor();
});
