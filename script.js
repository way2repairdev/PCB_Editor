// PCB File Editor JavaScript
class PCBFileEditor {
    constructor() {
        this.fileData = null;
        this.fileName = '';
        this.fileSize = 0;
        this.fileHandle = null; // Store file handle for direct saving
        this.lastDirectory = null; // Store last used directory
        this.netlist = [];
        this.netlistStartOffset = 0;
        this.netlistTotalSize = 0;
        this.debugLog = [];
        this.jsonData = null;
        this.jsonStartOffset = 0;
        this.jsonEndOffset = 0;
        
        this.initializeUI();
    }

    initializeUI() {
        // Get DOM elements
        this.openFileBtn = document.getElementById('openFileBtn');
        this.fileInput = document.getElementById('fileInput');
        this.saveFileBtn = document.getElementById('saveFileBtn');
        this.debugToggle = document.getElementById('debugToggle');
        this.rawDataToggle = document.getElementById('rawDataToggle');
        this.jsonDataToggle = document.getElementById('jsonDataToggle');
        this.rawJsonEditorToggle = document.getElementById('rawJsonEditorToggle');
        this.fileInfo = document.getElementById('fileInfo');
        this.debugView = document.getElementById('debugView');
        this.regularView = document.getElementById('regularView');
        this.debugConsole = document.getElementById('debugConsole');
        this.clearLogBtn = document.getElementById('clearLogBtn');
        this.showBytesBtn = document.getElementById('showBytesBtn');
        this.reparseBtn = document.getElementById('reparseBtn');
        this.netlistBody = document.getElementById('netlistBody');
        this.netlistOffset = document.getElementById('netlistOffset');
        this.netlistSize = document.getElementById('netlistSize');
        this.netlistSection = document.querySelector('.netlist-section');
        this.jsonSection = document.querySelector('.json-section');
        this.jsonRawEditorSection = document.querySelector('.json-raw-editor-section');
        this.partsBody = document.getElementById('partsBody');
        this.jsonNetsBody = document.getElementById('jsonNetsBody');
        this.jsonEditor = document.getElementById('jsonEditor');
        this.formatJsonBtn = document.getElementById('formatJsonBtn');
        this.validateJsonBtn = document.getElementById('validateJsonBtn');
        this.saveJsonBtn = document.getElementById('saveJsonBtn');
        this.addJsonDataBtn = document.getElementById('addJsonDataBtn');

        // Event listeners
        this.openFileBtn.addEventListener('click', () => this.openFileDialog());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.saveFileBtn.addEventListener('click', () => this.saveFile());
        this.debugToggle.addEventListener('change', () => this.toggleView());
        this.rawDataToggle.addEventListener('change', () => this.toggleRawDataView());
        this.jsonDataToggle.addEventListener('change', () => this.toggleJsonDataView());
        this.rawJsonEditorToggle.addEventListener('change', () => this.toggleRawJsonEditorView());
        this.clearLogBtn.addEventListener('click', () => this.clearDebugLog());
        this.showBytesBtn.addEventListener('click', () => this.showFirstBytes());
        this.reparseBtn.addEventListener('click', () => this.reparseNetlist());
        this.formatJsonBtn.addEventListener('click', () => this.formatJson());
        this.validateJsonBtn.addEventListener('click', () => this.validateJson());
        this.saveJsonBtn.addEventListener('click', () => this.saveJsonChanges());
        this.addJsonDataBtn.addEventListener('click', () => this.addJsonData());

        // Initial state
        this.toggleView();
        this.toggleRawDataView();
        this.toggleJsonDataView();
        this.toggleRawJsonEditorView();
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

    toggleRawDataView() {
        const showRawData = this.rawDataToggle.checked;
        if (this.netlistSection) {
            this.netlistSection.style.display = showRawData ? 'block' : 'none';
        }
    }

    toggleJsonDataView() {
        const showJsonData = this.jsonDataToggle.checked;
        if (this.jsonSection) {
            this.jsonSection.style.display = showJsonData ? 'block' : 'none';
        }
    }

    toggleRawJsonEditorView() {
        const showRawJsonEditor = this.rawJsonEditorToggle.checked;
        if (this.jsonRawEditorSection) {
            this.jsonRawEditorSection.style.display = showRawJsonEditor ? 'block' : 'none';
        }
    }

    async openFileDialog() {
        if ('showOpenFilePicker' in window) {
            try {
                const options = {
                    types: [{
                        description: 'PCB files',
                        accept: {
                            'application/octet-stream': ['.pcb']
                        }
                    }],
                    multiple: false
                };

                // Use last directory if available
                if (this.lastDirectory) {
                    options.startIn = this.lastDirectory;
                }

                const [fileHandle] = await window.showOpenFilePicker(options);
                this.fileHandle = fileHandle;
                this.lastDirectory = fileHandle;

                const file = await fileHandle.getFile();
                await this.processFile(file);
                
                this.addDebugLog('File opened using File System Access API with directory persistence', 'info');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    this.addDebugLog(`Error opening file: ${error.message}`, 'error');
                    // Fallback to traditional file input
                    this.fileInput.click();
                }
            }
        } else {
            this.addDebugLog('File System Access API not supported, falling back to traditional file input', 'info');
            this.fileInput.click();
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        await this.processFile(file);
    }

    async processFile(file) {
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
                this.parseJsonData();
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
        
        if (this.fileData.length < 0x44) {
            this.addDebugLog(`Error: File too small (< 0x44 bytes). Size: ${this.fileData.length}`, 'error');
            return;
        }
        
        // Read net_block_start from file header (offset 0x28, relative to 0x20)
        const netBlockStartRelative = this.readUInt32LE(this.fileData, 0x28);
        const netBlockStartAbsolute = 0x20 + netBlockStartRelative;
        this.addDebugLog(`Net block start (relative to 0x20): ${netBlockStartRelative} (0x${netBlockStartRelative.toString(16)})`, 'info');
        this.addDebugLog(`Net block start (absolute): ${netBlockStartAbsolute} (0x${netBlockStartAbsolute.toString(16)})`, 'info');
        
        this.netlistStartOffset = netBlockStartAbsolute;
        
        if (this.netlistStartOffset + 4 >= this.fileData.length) {
            this.addDebugLog('Error: Net block start exceeds file size', 'error');
            return;
        }
        
        // Read net block size (first 4 bytes of net block)
        this.netlistTotalSize = this.readUInt32LE(this.fileData, this.netlistStartOffset);
        this.addDebugLog(`Net block size: ${this.netlistTotalSize} bytes`, 'info');
        
        // Net data starts immediately after the block size
        const netDataStart = this.netlistStartOffset + 4;
        this.addDebugLog(`Net data starts at offset: ${netDataStart}`, 'info');
        
        let currentOffset = netDataStart; // Start parsing from net data
        const endOffset = this.netlistStartOffset + this.netlistTotalSize;
        this.addDebugLog(`Parsing entries from offset ${currentOffset} to ${endOffset}`, 'info');
        
        // Parse individual netlist entries until end of block
        let entryCount = 0;
        while (currentOffset + 8 < this.fileData.length && currentOffset < endOffset) {
            // Check for end pattern first (optional - struct doesn't specify this)
            if (this.checkEndPattern(this.fileData, currentOffset)) {
                this.addDebugLog(`Found end pattern at offset ${currentOffset}: 76 36 76 36 35 35 35 76 36 76 36`, 'info');
                break;
            }
            
            // Read single net size (4 bytes) - this is inclusive of all fields
            const singleNetSize = this.readUInt32LE(this.fileData, currentOffset);
            this.addDebugLog(`Entry ${entryCount} - Single net size: ${singleNetSize} at offset ${currentOffset}`, 'info');
            
            // Validate single net size (minimum 8: 4 for size + 4 for index)
            if (singleNetSize < 8 || singleNetSize > 1000) {
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
            
            // Read net name (remaining bytes: size - 8 bytes for size and index fields)
            const nameSize = singleNetSize - 8;
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
            
            // Move to next entry: go back to entry start and advance by full entry size
            currentOffset = currentOffset - 8 + singleNetSize; // -8 to go back to entry start, +singleNetSize to move to next
            
            // Log the next few bytes to help diagnose the parsing
            if (currentOffset < this.fileData.length - 8) {
                const nextBytes = Array.from(this.fileData.slice(currentOffset, currentOffset + 8))
                    .map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
                this.addDebugLog(`Next 8 bytes at offset ${currentOffset}: ${nextBytes}`, 'debug');
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

    async saveFile() {
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
            
            // Rebuild the JSON section if it exists
            if (this.jsonData) {
                newFileData = this.rebuildJsonData(newFileData);
            }
            
            this.addDebugLog(`Final file size: ${newFileData.length} bytes`, 'info');
            
            // Try to save directly, fallback to download
            const saveSuccessful = await this.saveFileDirectly(newFileData);
            
            // Update internal file data with the saved data for future operations only if save was successful
            if (saveSuccessful) {
                this.fileData = newFileData;
                this.fileSize = newFileData.length;
                this.addDebugLog('Internal file data updated with saved changes', 'info');
                this.updateFileInfo();
            }
            
        } catch (error) {
            this.addDebugLog(`Error during save: ${error.message}`, 'error');
        }
    }

    async saveFileDirectly(fileData) {
        // Check if File System Access API is supported
        if ('showSaveFilePicker' in window) {
            try {
                this.addDebugLog('Using File System Access API for direct save', 'info');
                
                // Prepare save options with directory persistence
                const saveOptions = {
                    suggestedName: this.fileName || 'modified.pcb',
                    types: [
                        {
                            description: 'PCB files',
                            accept: {
                                'application/octet-stream': ['.pcb'],
                            },
                        },
                    ],
                };

                // Use last directory if available
                if (this.lastDirectory) {
                    saveOptions.startIn = this.lastDirectory;
                    this.addDebugLog('Using saved directory for file picker', 'info');
                }
                
                // Show save file picker
                const fileHandle = await window.showSaveFilePicker(saveOptions);

                // Update last directory for future operations
                this.lastDirectory = fileHandle;

                // Create a writable stream
                const writable = await fileHandle.createWritable();
                
                // Write the data
                await writable.write(fileData);
                
                // Close the file
                await writable.close();
                
                this.addDebugLog(`File saved directly to: ${fileHandle.name}`, 'info');
                this.addDebugLog('Directory updated for future operations', 'info');
                
                return true; // Success
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    this.addDebugLog('Save operation cancelled by user', 'info');
                    return false; // User cancelled
                } else {
                    this.addDebugLog(`Direct save failed: ${error.message}`, 'warning');
                    // Fallback to download
                    this.downloadFile(fileData);
                    return true; // Download fallback succeeded
                }
            }
        } else {
            this.addDebugLog('File System Access API not supported, using download fallback', 'info');
            // Fallback to download for unsupported browsers
            this.downloadFile(fileData);
            return true; // Download fallback succeeded
        }
    }

    downloadFile(fileData) {
        // Create download link (original method)
        const blob = new Blob([fileData], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileName || 'modified.pcb';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addDebugLog(`File downloaded as: ${this.fileName}`, 'info');
    }

    rebuildNetlistData(fileData) {
        this.addDebugLog('Rebuilding netlist data...', 'info');
        
        // Calculate new netlist data
        let netlistData = new Uint8Array();
        let totalNetDataSize = 0; // Size of just the net entries (without block header)
        
        // Build each net entry
        for (const net of this.netlist) {
            const nameBytes = new TextEncoder().encode(net.netName);
            // NET SIZE = 4 (size field) + 4 (index field) + name bytes (inclusive)
            const netSize = 4 + 4 + nameBytes.length;
            const entrySize = netSize; // The net size IS the entry size
            
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
            
            totalNetDataSize += entrySize;
            
            this.addDebugLog(`Net "${net.netName}": size=${netSize}, entry_size=${entrySize}`, 'debug');
        }
        
        // Total block size = just the net entries (block_size field indicates size after itself)
        const totalNetlistSize = totalNetDataSize; // block_size = size of net data only
        
        this.addDebugLog(`Total new netlist size: ${totalNetlistSize} bytes`, 'info');
        this.addDebugLog(`Original netlist size: ${this.netlistTotalSize} bytes`, 'info');
        this.addDebugLog(`Net data size (without block header): ${totalNetDataSize} bytes`, 'info');
        
        // Get net block start position (no offset, directly at netlistStartOffset)
        const netBlockStart = this.netlistStartOffset;
        const originalNetBlockEnd = netBlockStart + 4 + this.netlistTotalSize; // +4 for block_size field
        this.addDebugLog(`Net block starts at offset: ${netBlockStart}`, 'info');
        this.addDebugLog(`Original net block ends at offset: ${originalNetBlockEnd}`, 'info');
        
        // Log what's at the original end to see if there are extra bytes
        if (originalNetBlockEnd < fileData.length) {
            const bytesAtEnd = Array.from(fileData.slice(originalNetBlockEnd - 8, originalNetBlockEnd + 8))
                .map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            this.addDebugLog(`Bytes around original net block end: ${bytesAtEnd}`, 'info');
        }
        
        // Calculate size difference
        const sizeDifference = totalNetlistSize - this.netlistTotalSize;
        this.addDebugLog(`Size difference: ${sizeDifference} bytes`, 'info');
        
        // Create new file with adjusted size
        const newFileSize = fileData.length + sizeDifference;
        this.addDebugLog(`New file size will be: ${newFileSize} bytes (was ${fileData.length})`, 'info');
        
        const newFileData = new Uint8Array(Math.max(newFileSize, netBlockStart + 4 + totalNetlistSize));
        
        // Copy everything before the net block
        newFileData.set(fileData.slice(0, netBlockStart));
        this.addDebugLog(`Copied ${netBlockStart} bytes before net block`, 'info');
        
        // Write net block size at the beginning of net block (size of net data only)
        const totalSizeBytes = new Uint32Array([totalNetlistSize]);
        const totalSizeBytesArray = new Uint8Array(totalSizeBytes.buffer);
        newFileData.set(totalSizeBytesArray, netBlockStart);
        this.addDebugLog(`Wrote block size ${totalNetlistSize} at offset ${netBlockStart}`, 'info');
        
        // Insert new netlist data after the block size
        newFileData.set(netlistData, netBlockStart + 4);
        this.addDebugLog(`Inserted ${netlistData.length} bytes of netlist data at offset ${netBlockStart + 4}`, 'info');
        
        // Log what we just wrote
        const newNetBlockEnd = netBlockStart + 4 + totalNetlistSize;
        this.addDebugLog(`New net block ends at offset: ${newNetBlockEnd}`, 'info');
        
        if (newNetBlockEnd < newFileData.length) {
            const bytesAtNewEnd = Array.from(newFileData.slice(newNetBlockEnd - 8, newNetBlockEnd + 8))
                .map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            this.addDebugLog(`Bytes around new net block end: ${bytesAtNewEnd}`, 'info');
        }
        
        // Copy everything after the original net block (if any)
        const remainingDataSize = fileData.length - originalNetBlockEnd;
        this.addDebugLog(`Remaining data after original net block: ${remainingDataSize} bytes`, 'info');
        
        if (originalNetBlockEnd < fileData.length && remainingDataSize > 0) {
            const remainingData = fileData.slice(originalNetBlockEnd);
            const newOffset = netBlockStart + 4 + totalNetlistSize; // +4 for block_size field
            
            this.addDebugLog(`Copying ${remainingData.length} bytes from offset ${originalNetBlockEnd} to offset ${newOffset}`, 'info');
            
            // Make sure we don't exceed the new file buffer
            if (newOffset + remainingData.length <= newFileData.length) {
                newFileData.set(remainingData, newOffset);
                this.addDebugLog(`Successfully copied ${remainingData.length} bytes after net block`, 'info');
            } else {
                this.addDebugLog(`ERROR: Would exceed file buffer! newOffset=${newOffset}, remainingData.length=${remainingData.length}, newFileData.length=${newFileData.length}`, 'error');
            }
        } else {
            this.addDebugLog(`No remaining data to copy after net block`, 'info');
        }
        
        // Update our internal size tracking
        this.netlistTotalSize = totalNetlistSize;
        
        this.addDebugLog(`Netlist rebuilt with ${this.netlist.length} entries, total size: ${totalNetlistSize} bytes`, 'info');
        this.addDebugLog(`Final file size: ${newFileData.length} bytes`, 'info');
        
        return newFileData;
    }

    // JSON Data Methods
    parseJsonData() {
        this.addDebugLog('=== Starting JSON data parsing ===', 'info');
        
        // Look for hex patterns: 
        // 3D 3D 3D 50 43 42 B8 BD BC D3 0D (original)
        // 3D 3D 3D 50 43 42 B8 BD BC D3 0A (alternative)
        const jsonPatterns = [
            [0x3D, 0x3D, 0x3D, 0x50, 0x43, 0x42, 0xB8, 0xBD, 0xBC, 0xD3, 0x0D],
            [0x3D, 0x3D, 0x3D, 0x50, 0x43, 0x42, 0xB8, 0xBD, 0xBC, 0xD3, 0x0A]
        ];
        
        let patternOffset = -1;
        let foundPattern = null;
        
        for (let i = 0; i < jsonPatterns.length; i++) {
            const pattern = jsonPatterns[i];
            const offset = this.findHexPattern(this.fileData, pattern);
            if (offset !== -1) {
                patternOffset = offset;
                foundPattern = pattern;
                const variant = i === 0 ? '0D variant' : '0A variant';
                this.addDebugLog(`JSON pattern found (${variant}) at offset: ${patternOffset} (0x${patternOffset.toString(16)})`, 'info');
                break;
            }
        }
        
        if (patternOffset === -1) {
            this.addDebugLog('JSON pattern not found in file (checked both 0D and 0A variants)', 'info');
            this.jsonData = null;
            this.updateJsonButtonState();
            return;
        }
        
        this.jsonStartOffset = patternOffset + foundPattern.length;
        
        // Find the end of JSON data (look for next non-printable pattern or end of file)
        this.jsonEndOffset = this.findJsonEnd(this.jsonStartOffset);
        
        const jsonLength = this.jsonEndOffset - this.jsonStartOffset;
        this.addDebugLog(`JSON data length: ${jsonLength} bytes`, 'info');
        
        if (jsonLength <= 0) {
            this.addDebugLog('No JSON data found after pattern', 'warning');
            return;
        }
        
        // Extract JSON data
        const jsonBytes = this.fileData.slice(this.jsonStartOffset, this.jsonEndOffset);
        let jsonString = '';
        
        try {
            jsonString = new TextDecoder('utf-8').decode(jsonBytes);
            this.jsonData = JSON.parse(jsonString);
            this.addDebugLog('JSON data parsed successfully', 'info');
            this.addDebugLog(`Found ${this.jsonData.part?.length || 0} parts and ${this.jsonData.net?.length || 0} nets`, 'info');
            
            this.updateJsonDisplay();
        } catch (error) {
            this.addDebugLog(`Error parsing JSON: ${error.message}`, 'error');
            this.jsonData = null;
        }
        
        // Update button state based on JSON availability
        this.updateJsonButtonState();
    }

    findHexPattern(data, pattern) {
        for (let i = 0; i <= data.length - pattern.length; i++) {
            let match = true;
            for (let j = 0; j < pattern.length; j++) {
                if (data[i + j] !== pattern[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
    }

    findJsonEnd(startOffset) {
        // Look for the end of JSON data (find closing brace and check for non-printable bytes)
        let braceCount = 0;
        let inString = false;
        let escaped = false;
        
        for (let i = startOffset; i < this.fileData.length; i++) {
            const byte = this.fileData[i];
            const char = String.fromCharCode(byte);
            
            if (!inString) {
                if (char === '{') braceCount++;
                else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        return i + 1; // Include the closing brace
                    }
                }
                else if (char === '"') inString = true;
            } else {
                if (!escaped && char === '"') inString = false;
                escaped = !escaped && char === '\\';
            }
            
            // If we encounter non-printable characters and braces are balanced, stop
            if (braceCount === 0 && (byte < 0x20 || byte > 0x7E) && byte !== 0x0A && byte !== 0x0D && byte !== 0x09) {
                return i;
            }
        }
        
        return this.fileData.length;
    }

    updateJsonDisplay() {
        if (!this.jsonData) return;
        
        // Update JSON editor
        this.jsonEditor.value = JSON.stringify(this.jsonData, null, 2);
        
        // Update parts table
        this.updatePartsTable();
        
        // Update nets table
        this.updateJsonNetsTable();
    }

    updateJsonButtonState() {
        if (this.addJsonDataBtn) {
            if (this.jsonData) {
                // JSON data exists - disable button
                this.addJsonDataBtn.disabled = true;
                this.addJsonDataBtn.title = 'JSON data already exists in this file';
                this.addDebugLog('Add JSON Data button disabled - JSON data already exists', 'info');
            } else {
                // No JSON data - enable button
                this.addJsonDataBtn.disabled = false;
                this.addJsonDataBtn.title = 'Add JSON data structure to the end of the file';
                this.addDebugLog('Add JSON Data button enabled - no JSON data found', 'info');
            }
        }
    }

    addJsonData() {
        if (!this.fileData) {
            this.addDebugLog('No file loaded to add JSON data to!', 'error');
            alert('Please load a PCB file first.');
            return;
        }

        if (this.jsonData) {
            this.addDebugLog('JSON data already exists in this file!', 'warning');
            alert('JSON data already exists in this file.');
            return;
        }

        // Confirm with user
        if (!confirm('Add JSON data structure to the end of this file?\n\nThis will add a hex pattern followed by an empty JSON structure with sample data.')) {
            return;
        }

        this.addDebugLog('Adding JSON data to file...', 'info');

        // Create default JSON structure
        const defaultJsonData = {
            part: [
                {
                    reference: "U1",
                    value: "IC",
                    alias: "Chip1",
                    pad: [
                        {
                            name: "1",
                            alias: "A1",
                            diode: "0"
                        }
                    ]
                }
            ],
            net: [
                {
                    name: "NET1",
                    alias: "Signal1"
                }
            ]
        };

        const jsonString = JSON.stringify(defaultJsonData, null, 2);
        const jsonBytes = new TextEncoder().encode(jsonString);

        // Create the hex pattern: 3D 3D 3D 50 43 42 B8 BD BC D3 0D
        const hexPattern = new Uint8Array([0x3D, 0x3D, 0x3D, 0x50, 0x43, 0x42, 0xB8, 0xBD, 0xBC, 0xD3, 0x0D]);

        // Create new file data with hex pattern + JSON at the end
        const newFileSize = this.fileData.length + hexPattern.length + jsonBytes.length;
        const newFileData = new Uint8Array(newFileSize);

        // Copy original file data
        newFileData.set(this.fileData, 0);

        // Add hex pattern
        newFileData.set(hexPattern, this.fileData.length);

        // Add JSON data
        newFileData.set(jsonBytes, this.fileData.length + hexPattern.length);

        // Update internal file data
        this.fileData = newFileData;
        this.fileSize = newFileData.length;

        this.addDebugLog(`Added JSON data to file. New file size: ${newFileSize} bytes`, 'info');
        this.addDebugLog(`Hex pattern added at offset: ${this.fileData.length - hexPattern.length - jsonBytes.length}`, 'info');
        this.addDebugLog(`JSON data added at offset: ${this.fileData.length - jsonBytes.length}`, 'info');

        // Re-parse JSON data to update the UI
        this.parseJsonData();

        // Enable save button
        this.saveFileBtn.disabled = false;

        // Update file info
        this.updateFileInfo();

        this.addDebugLog('JSON data structure added successfully!', 'info');
        alert('JSON data structure has been added to the file.\n\nYou can now edit the parts and nets, and save the file.');
    }

    updatePartsTable() {
        this.partsBody.innerHTML = '';
        
        if (!this.jsonData?.part) return;
        
        this.jsonData.part.forEach((part, index) => {
            const row = document.createElement('tr');
            const padsInfo = part.pad ? `${part.pad.length} pads` : 'No pads';
            const partValue = part.value || ''; // Handle cases where value might not exist
            
            // Create pad dropdown options
            let padDropdownOptions = '<option value="">Select Pad</option>';
            if (part.pad && part.pad.length > 0) {
                part.pad.forEach((pad, padIndex) => {
                    const padName = pad.name || `Pad ${padIndex + 1}`;
                    padDropdownOptions += `<option value="${padIndex}">${padName}</option>`;
                });
            }
            
            row.innerHTML = `
                <td class="part-reference" data-index="${index}">
                    <span class="part-reference-display">${part.reference}</span>
                    <input class="part-reference-input" type="text" value="${part.reference}" style="display: none;">
                </td>
                <td class="part-value" data-index="${index}">
                    <span class="part-value-display">${partValue}</span>
                    <input class="part-value-input" type="text" value="${partValue}" style="display: none;">
                </td>
                <td class="part-alias" data-index="${index}">
                    <span class="part-alias-display">${part.alias}</span>
                    <input class="part-alias-input" type="text" value="${part.alias}" style="display: none;">
                </td>
                <td>${padsInfo}</td>
                <td>
                    <select class="pad-selector" onchange="pcbEditor.onPadSelected(${index}, this.value)">
                        ${padDropdownOptions}
                    </select>
                </td>
                <td class="pad-name-cell" data-index="${index}">
                    <span class="pad-name-display">-</span>
                    <input class="pad-name-input" type="text" value="" style="display: none;">
                </td>
                <td class="pad-alias-cell" data-index="${index}">
                    <span class="pad-alias-display">-</span>
                    <input class="pad-alias-input" type="text" value="" style="display: none;">
                </td>
                <td class="diode-reading-cell" data-index="${index}">
                    <span class="diode-reading-display" id="diodeReading-${index}">-</span>
                    <input class="diode-reading-input" type="text" value="" style="display: none;">
                </td>
                <td>
                    <button class="btn-pad" onclick="pcbEditor.addPad(${index})">Add Pad</button>
                    <button class="btn-pad" onclick="pcbEditor.deletePad(${index})" ${!part.pad || part.pad.length === 0 ? 'disabled' : ''}>Delete Pad</button>
                </td>
                <td>
                    <button class="btn-edit" onclick="pcbEditor.editPart(${index})">Edit</button>
                    <button class="btn-edit save-btn" onclick="pcbEditor.savePart(${index})" style="display: none;">Save</button>
                    <button class="btn-edit cancel-btn" onclick="pcbEditor.cancelEditPart(${index})" style="display: none;">Cancel</button>
                    <button class="btn-edit btn-delete-row" onclick="pcbEditor.deletePartByIndex(${index})">Delete</button>
                </td>
            `;
            this.partsBody.appendChild(row);
        });
    }

    updateJsonNetsTable() {
        this.jsonNetsBody.innerHTML = '';
        
        if (!this.jsonData?.net) return;
        
        this.jsonData.net.forEach((net, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="json-net-name" data-index="${index}">
                    <span class="json-net-name-display">${net.name}</span>
                    <input class="json-net-name-input" type="text" value="${net.name}" style="display: none;">
                </td>
                <td class="json-net-alias" data-index="${index}">
                    <span class="json-net-alias-display">${net.alias}</span>
                    <input class="json-net-alias-input" type="text" value="${net.alias}" style="display: none;">
                </td>
                <td>
                    <button class="btn-edit" onclick="pcbEditor.editJsonNet(${index})">Edit</button>
                    <button class="btn-edit save-btn" onclick="pcbEditor.saveJsonNet(${index})" style="display: none;">Save</button>
                    <button class="btn-edit cancel-btn" onclick="pcbEditor.cancelEditJsonNet(${index})" style="display: none;">Cancel</button>
                    <button class="btn-edit btn-delete-row" onclick="pcbEditor.deleteJsonNetByIndex(${index})">Delete</button>
                </td>
            `;
            this.jsonNetsBody.appendChild(row);
        });
    }

    // JSON Editing Methods
    editPart(index) {
        const referenceCell = document.querySelector(`[data-index="${index}"].part-reference`);
        const valueCell = document.querySelector(`[data-index="${index}"].part-value`);
        const aliasCell = document.querySelector(`[data-index="${index}"].part-alias`);
        const padNameCell = document.querySelector(`[data-index="${index}"].pad-name-cell`);
        const padAliasCell = document.querySelector(`[data-index="${index}"].pad-alias-cell`);
        const diodeCell = document.querySelector(`[data-index="${index}"].diode-reading-cell`);
        
        this.toggleEditMode(referenceCell, true);
        this.toggleEditMode(valueCell, true);
        this.toggleEditMode(aliasCell, true);
        this.toggleEditMode(padNameCell, true);
        this.toggleEditMode(padAliasCell, true);
        this.toggleEditMode(diodeCell, true);
        this.toggleActionButtons(referenceCell, true);
    }

    savePart(index) {
        const referenceCell = document.querySelector(`[data-index="${index}"].part-reference`);
        const valueCell = document.querySelector(`[data-index="${index}"].part-value`);
        const aliasCell = document.querySelector(`[data-index="${index}"].part-alias`);
        const padNameCell = document.querySelector(`[data-index="${index}"].pad-name-cell`);
        const padAliasCell = document.querySelector(`[data-index="${index}"].pad-alias-cell`);
        const diodeCell = document.querySelector(`[data-index="${index}"].diode-reading-cell`);
        
        const newReference = referenceCell.querySelector('.part-reference-input').value;
        const newValue = valueCell.querySelector('.part-value-input').value;
        const newAlias = aliasCell.querySelector('.part-alias-input').value;
        const newPadName = padNameCell.querySelector('.pad-name-input').value;
        const newPadAlias = padAliasCell.querySelector('.pad-alias-input').value;
        const newDiodeReading = diodeCell.querySelector('.diode-reading-input').value;
        
        this.jsonData.part[index].reference = newReference;
        this.jsonData.part[index].value = newValue;
        this.jsonData.part[index].alias = newAlias;
        
        // Update pad name, alias, and diode reading for the currently selected pad
        const row = referenceCell.closest('tr');
        const padSelector = row.querySelector('select.pad-selector');
        if (padSelector && padSelector.value !== '') {
            const padIndex = parseInt(padSelector.value);
            if (this.jsonData.part[index].pad && this.jsonData.part[index].pad[padIndex]) {
                this.jsonData.part[index].pad[padIndex].name = newPadName;
                this.jsonData.part[index].pad[padIndex].alias = newPadAlias;
                this.jsonData.part[index].pad[padIndex].diode = newDiodeReading;
                this.addDebugLog(`Updated pad ${padIndex}: Name="${newPadName}", Alias="${newPadAlias}", Diode="${newDiodeReading}"`, 'info');
            }
        }
        
        this.toggleEditMode(referenceCell, false);
        this.toggleEditMode(valueCell, false);
        this.toggleEditMode(aliasCell, false);
        this.toggleEditMode(padNameCell, false);
        this.toggleEditMode(padAliasCell, false);
        this.toggleEditMode(diodeCell, false);
        this.toggleActionButtons(referenceCell, false);
        
        this.updateJsonDisplay();
        this.saveFileBtn.disabled = false;
        this.addDebugLog(`Part ${index} updated: ${newReference} (${newValue}) -> ${newAlias}`, 'info');
    }

    cancelEditPart(index) {
        const referenceCell = document.querySelector(`[data-index="${index}"].part-reference`);
        const valueCell = document.querySelector(`[data-index="${index}"].part-value`);
        const aliasCell = document.querySelector(`[data-index="${index}"].part-alias`);
        const padNameCell = document.querySelector(`[data-index="${index}"].pad-name-cell`);
        const padAliasCell = document.querySelector(`[data-index="${index}"].pad-alias-cell`);
        const diodeCell = document.querySelector(`[data-index="${index}"].diode-reading-cell`);
        
        this.toggleEditMode(referenceCell, false);
        this.toggleEditMode(valueCell, false);
        this.toggleEditMode(aliasCell, false);
        this.toggleEditMode(padNameCell, false);
        this.toggleEditMode(padAliasCell, false);
        this.toggleEditMode(diodeCell, false);
        this.toggleActionButtons(referenceCell, false);
    }

    editJsonNet(index) {
        const nameCell = document.querySelector(`[data-index="${index}"].json-net-name`);
        const aliasCell = document.querySelector(`[data-index="${index}"].json-net-alias`);
        
        this.toggleEditMode(nameCell, true);
        this.toggleEditMode(aliasCell, true);
        this.toggleActionButtons(nameCell, true);
    }

    saveJsonNet(index) {
        const nameCell = document.querySelector(`[data-index="${index}"].json-net-name`);
        const aliasCell = document.querySelector(`[data-index="${index}"].json-net-alias`);
        
        const newName = nameCell.querySelector('.json-net-name-input').value;
        const newAlias = aliasCell.querySelector('.json-net-alias-input').value;
        
        this.jsonData.net[index].name = newName;
        this.jsonData.net[index].alias = newAlias;
        
        this.toggleEditMode(nameCell, false);
        this.toggleEditMode(aliasCell, false);
        this.toggleActionButtons(nameCell, false);
        
        this.updateJsonDisplay();
        this.saveFileBtn.disabled = false;
        this.addDebugLog(`JSON Net ${index} updated: ${newName} -> ${newAlias}`, 'info');
    }

    cancelEditJsonNet(index) {
        const nameCell = document.querySelector(`[data-index="${index}"].json-net-name`);
        const aliasCell = document.querySelector(`[data-index="${index}"].json-net-alias`);
        
        this.toggleEditMode(nameCell, false);
        this.toggleEditMode(aliasCell, false);
        this.toggleActionButtons(nameCell, false);
    }

    // Pad Selection and Diode Reading Methods
    onPadSelected(partIndex, padIndex) {
        if (padIndex === '') {
            // Clear pad name, alias, and diode reading if no pad selected
            const padNameDisplay = document.querySelector(`[data-index="${partIndex}"].pad-name-cell .pad-name-display`);
            const padNameInput = document.querySelector(`[data-index="${partIndex}"].pad-name-cell .pad-name-input`);
            const padAliasDisplay = document.querySelector(`[data-index="${partIndex}"].pad-alias-cell .pad-alias-display`);
            const padAliasInput = document.querySelector(`[data-index="${partIndex}"].pad-alias-cell .pad-alias-input`);
            const diodeDisplay = document.getElementById(`diodeReading-${partIndex}`);
            const diodeCell = document.querySelector(`[data-index="${partIndex}"].diode-reading-cell`);
            
            if (padNameDisplay) padNameDisplay.textContent = '-';
            if (padNameInput) padNameInput.value = '';
            if (padAliasDisplay) padAliasDisplay.textContent = '-';
            if (padAliasInput) padAliasInput.value = '';
            if (diodeDisplay) diodeDisplay.textContent = '-';
            if (diodeCell) {
                const input = diodeCell.querySelector('.diode-reading-input');
                if (input) input.value = '';
            }
            return;
        }

        const part = this.jsonData.part[partIndex];
        if (!part || !part.pad || !part.pad[padIndex]) {
            this.addDebugLog(`Invalid pad selection: Part ${partIndex}, Pad ${padIndex}`, 'error');
            return;
        }

        const selectedPad = part.pad[padIndex];
        const padName = selectedPad.name || `Pad ${parseInt(padIndex) + 1}`;
        const padAlias = selectedPad.alias || '';
        
        this.addDebugLog(`Selected pad: ${part.reference} - ${padName} (${padAlias})`, 'info');
        
        // Get diode reading for the selected pad
        const diodeReading = this.getDiodeReading(selectedPad);
        const diodeValue = selectedPad.diode || '';
        
        // Update the pad name display and input
        const padNameDisplay = document.querySelector(`[data-index="${partIndex}"].pad-name-cell .pad-name-display`);
        const padNameInput = document.querySelector(`[data-index="${partIndex}"].pad-name-cell .pad-name-input`);
        
        if (padNameDisplay) {
            padNameDisplay.textContent = padName;
        }
        if (padNameInput) {
            padNameInput.value = padName;
        }
        
        // Update the pad alias display and input
        const padAliasDisplay = document.querySelector(`[data-index="${partIndex}"].pad-alias-cell .pad-alias-display`);
        const padAliasInput = document.querySelector(`[data-index="${partIndex}"].pad-alias-cell .pad-alias-input`);
        
        if (padAliasDisplay) {
            padAliasDisplay.textContent = padAlias || '-';
        }
        if (padAliasInput) {
            padAliasInput.value = padAlias;
        }
        
        // Update the diode reading display
        const diodeDisplay = document.getElementById(`diodeReading-${partIndex}`);
        const diodeCell = document.querySelector(`[data-index="${partIndex}"].diode-reading-cell`);
        
        if (diodeDisplay) {
            diodeDisplay.textContent = diodeReading;
        }
        
        // Update the input field with the raw diode value for editing
        if (diodeCell) {
            const input = diodeCell.querySelector('.diode-reading-input');
            if (input) {
                input.value = diodeValue;
            }
        }
        
        this.addDebugLog(`Pad details - Name: ${padName}, Alias: ${padAlias}, Diode: ${diodeReading}`, 'info');
    }

    getDiodeReading(pad) {
        // Check for the actual diode property format first
        if (pad.diode !== undefined) {
            return `${pad.diode}`;
        }
        
        // Check for other possible diode reading properties
        if (pad.diode_reading !== undefined) {
            return `${pad.diode_reading}V`;
        }
        if (pad.diodeReading !== undefined) {
            return `${pad.diodeReading}V`;
        }
        if (pad.voltage !== undefined) {
            return `${pad.voltage}V`;
        }
        if (pad.reading !== undefined) {
            return `${pad.reading}V`;
        }
        if (pad.test_voltage !== undefined) {
            return `${pad.test_voltage}V`;
        }
        if (pad.testVoltage !== undefined) {
            return `${pad.testVoltage}V`;
        }
        
        // If no diode reading found, return a default message
        return 'No reading';
    }

    // Pad Management Methods
    addPad(partIndex) {
        const part = this.jsonData.part[partIndex];
        if (!part) {
            this.addDebugLog(`Invalid part index: ${partIndex}`, 'error');
            return;
        }

        // Initialize pad array if it doesn't exist
        if (!part.pad) {
            part.pad = [];
        }

        // Prompt for pad details
        const padName = prompt('Enter pad name:', `${part.pad.length + 1}`);
        if (padName === null) {
            return; // User cancelled
        }

        const padAlias = prompt('Enter pad alias:', '');
        if (padAlias === null) {
            return; // User cancelled
        }

        const diodeReading = prompt('Enter diode reading (numeric value):', '0');
        if (diodeReading === null) {
            return; // User cancelled
        }

        // Create new pad with entered values
        const newPad = {
            name: padName || `${part.pad.length + 1}`,
            alias: padAlias || '',
            diode: diodeReading || "0"
        };

        part.pad.push(newPad);
        
        this.addDebugLog(`Added new pad to ${part.reference}: ${newPad.name} (${newPad.alias}) - ${newPad.diode}mV`, 'info');
        
        // Refresh the display
        this.updateJsonDisplay();
        this.saveFileBtn.disabled = false;
    }

    deletePad(partIndex) {
        const part = this.jsonData.part[partIndex];
        if (!part || !part.pad || part.pad.length === 0) {
            this.addDebugLog(`No pads to delete for part ${partIndex}`, 'warning');
            alert('No pads available to delete.');
            return;
        }

        // Get the currently selected pad from the dropdown
        const row = document.querySelector(`[data-index="${partIndex}"].part-reference`).closest('tr');
        const padSelector = row.querySelector('select.pad-selector');
        let padToDelete = -1;

        if (padSelector && padSelector.value !== '') {
            padToDelete = parseInt(padSelector.value);
        } else {
            // If no pad is selected, ask user which pad to delete
            const padOptions = part.pad.map((pad, index) => 
                `${index}: ${pad.name || `Pad ${index + 1}`} (${pad.diode}mV)`
            ).join('\n');
            
            const response = prompt(`Select pad to delete by entering its number:\n${padOptions}`);
            if (response === null) {
                return; // User cancelled
            }
            
            padToDelete = parseInt(response);
            if (isNaN(padToDelete) || padToDelete < 0 || padToDelete >= part.pad.length) {
                alert('Invalid pad number.');
                return;
            }
        }

        const deletedPadName = part.pad[padToDelete].name || `Pad ${padToDelete + 1}`;
        
        // Confirm deletion
        if (!confirm(`Delete pad "${deletedPadName}" from ${part.reference}?`)) {
            return;
        }
        
        // Remove the pad
        part.pad.splice(padToDelete, 1);
        
        this.addDebugLog(`Deleted pad from ${part.reference}: ${deletedPadName}`, 'info');
        
        // Clear diode reading display
        const diodeDisplay = document.getElementById(`diodeReading-${partIndex}`);
        if (diodeDisplay) {
            diodeDisplay.textContent = '-';
        }
        
        // Refresh the display
        this.updateJsonDisplay();
        this.saveFileBtn.disabled = false;
    }

    // Part Management Methods
    addPart() {
        if (!this.jsonData) {
            this.addDebugLog('No JSON data available', 'error');
            return;
        }

        // Initialize part array if it doesn't exist
        if (!this.jsonData.part) {
            this.jsonData.part = [];
        }

        // Prompt for part details
        const reference = prompt('Enter part reference:', `U${this.jsonData.part.length + 1}`);
        if (reference === null) {
            return; // User cancelled
        }

        const value = prompt('Enter part value (optional):', '');
        if (value === null) {
            return; // User cancelled
        }

        const alias = prompt('Enter part alias:', `${reference.toLowerCase()}_alias`);
        if (alias === null) {
            return; // User cancelled
        }

        // Create new part with entered values
        const newPart = {
            reference: reference || `U${this.jsonData.part.length + 1}`,
            value: value || '',
            alias: alias || `${reference.toLowerCase()}_alias`,
            pad: []
        };

        this.jsonData.part.push(newPart);
        
        this.addDebugLog(`Added new part: ${newPart.reference} (${newPart.value}) -> ${newPart.alias}`, 'info');
        
        // Refresh the display
        this.updateJsonDisplay();
        this.saveFileBtn.disabled = false;
    }

    deletePartByIndex(partIndex) {
        if (!this.jsonData || !this.jsonData.part || partIndex < 0 || partIndex >= this.jsonData.part.length) {
            this.addDebugLog(`Invalid part index: ${partIndex}`, 'error');
            return;
        }

        const partToDelete = this.jsonData.part[partIndex];
        
        // Confirm deletion
        if (!confirm(`Delete part "${partToDelete.reference}" (${partToDelete.value || 'no value'})?`)) {
            return;
        }
        
        // Remove the part
        this.jsonData.part.splice(partIndex, 1);
        
        this.addDebugLog(`Deleted part: ${partToDelete.reference}`, 'info');
        
        // Refresh the display
        this.updateJsonDisplay();
        this.saveFileBtn.disabled = false;
    }

    // Net Management Methods
    addJsonNet() {
        if (!this.jsonData) {
            this.addDebugLog('No JSON data available', 'error');
            return;
        }

        // Initialize net array if it doesn't exist
        if (!this.jsonData.net) {
            this.jsonData.net = [];
        }

        // Prompt for net details
        const netName = prompt('Enter net name:', `NET${this.jsonData.net.length + 1}`);
        if (netName === null) {
            return; // User cancelled
        }

        const alias = prompt('Enter net alias:', `${netName.toLowerCase()}_alias`);
        if (alias === null) {
            return; // User cancelled
        }

        // Create new net with entered values
        const newNet = {
            name: netName || `NET${this.jsonData.net.length + 1}`,
            alias: alias || `${netName.toLowerCase()}_alias`
        };

        this.jsonData.net.push(newNet);
        
        this.addDebugLog(`Added new net: ${newNet.name} -> ${newNet.alias}`, 'info');
        
        // Refresh the display
        this.updateJsonDisplay();
        this.saveFileBtn.disabled = false;
    }

    deleteJsonNetByIndex(netIndex) {
        if (!this.jsonData || !this.jsonData.net || netIndex < 0 || netIndex >= this.jsonData.net.length) {
            this.addDebugLog(`Invalid net index: ${netIndex}`, 'error');
            return;
        }

        const netToDelete = this.jsonData.net[netIndex];
        
        // Confirm deletion
        if (!confirm(`Delete net "${netToDelete.name}" -> "${netToDelete.alias}"?`)) {
            return;
        }
        
        // Remove the net
        this.jsonData.net.splice(netIndex, 1);
        
        this.addDebugLog(`Deleted net: ${netToDelete.name}`, 'info');
        
        // Refresh the display
        this.updateJsonDisplay();
        this.saveFileBtn.disabled = false;
    }

    toggleEditMode(cell, editMode) {
        const display = cell.querySelector('[class$="-display"]');
        const input = cell.querySelector('[class$="-input"]');
        
        if (editMode) {
            display.style.display = 'none';
            input.style.display = 'inline-block';
            input.focus();
            input.select();
        } else {
            display.style.display = 'inline-block';
            input.style.display = 'none';
            input.value = display.textContent; // Reset to original value
        }
    }

    toggleActionButtons(cell, editMode) {
        const row = cell.parentElement;
        const editBtn = row.querySelector('.btn-edit:not(.save-btn):not(.cancel-btn)');
        const saveBtn = row.querySelector('.save-btn');
        const cancelBtn = row.querySelector('.cancel-btn');
        
        if (editMode) {
            editBtn.style.display = 'none';
            saveBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
        } else {
            editBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        }
    }

    // JSON Editor Methods
    formatJson() {
        try {
            const jsonObj = JSON.parse(this.jsonEditor.value);
            this.jsonEditor.value = JSON.stringify(jsonObj, null, 2);
            this.addDebugLog('JSON formatted successfully', 'info');
        } catch (error) {
            this.addDebugLog(`JSON format error: ${error.message}`, 'error');
        }
    }

    validateJson() {
        try {
            JSON.parse(this.jsonEditor.value);
            this.addDebugLog('JSON is valid', 'info');
        } catch (error) {
            this.addDebugLog(`JSON validation error: ${error.message}`, 'error');
        }
    }

    saveJsonChanges() {
        try {
            this.jsonData = JSON.parse(this.jsonEditor.value);
            this.updateJsonDisplay();
            this.saveFileBtn.disabled = false;
            this.addDebugLog('JSON changes saved', 'info');
        } catch (error) {
            this.addDebugLog(`Error saving JSON changes: ${error.message}`, 'error');
        }
    }

    rebuildJsonData(fileData) {
        if (!this.jsonData || this.jsonStartOffset === 0) {
            return fileData;
        }
        
        this.addDebugLog('Rebuilding JSON data...', 'info');
        
        // Convert JSON object back to string (single line, no spaces)
        const newJsonString = JSON.stringify(this.jsonData);
        const newJsonBytes = new TextEncoder().encode(newJsonString);
        
        const originalJsonLength = this.jsonEndOffset - this.jsonStartOffset;
        const sizeDifference = newJsonBytes.length - originalJsonLength;
        
        this.addDebugLog(`Original JSON size: ${originalJsonLength} bytes`, 'info');
        this.addDebugLog(`New JSON size: ${newJsonBytes.length} bytes`, 'info');
        this.addDebugLog(`Size difference: ${sizeDifference} bytes`, 'info');
        this.addDebugLog(`JSON format: single line, no spaces`, 'info');
        
        // Create new file buffer with adjusted size
        const newFileSize = fileData.length + sizeDifference;
        const newFileData = new Uint8Array(newFileSize);
        
        // Copy data before JSON
        newFileData.set(fileData.slice(0, this.jsonStartOffset));
        
        // Insert new JSON data
        newFileData.set(newJsonBytes, this.jsonStartOffset);
        
        // Copy data after original JSON
        if (this.jsonEndOffset < fileData.length) {
            const remainingData = fileData.slice(this.jsonEndOffset);
            newFileData.set(remainingData, this.jsonStartOffset + newJsonBytes.length);
        }
        
        // Update JSON end offset for future operations
        this.jsonEndOffset = this.jsonStartOffset + newJsonBytes.length;
        
        this.addDebugLog(`JSON data rebuilt successfully`, 'info');
        return newFileData;
    }

    // Search Methods
    searchParts(searchTerm) {
        const partsTable = document.getElementById('partsTable');
        const tbody = partsTable.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr');

        searchTerm = searchTerm.toLowerCase().trim();

        rows.forEach(row => {
            if (!searchTerm) {
                // Show all rows if search is empty
                row.style.display = '';
                return;
            }

            // Get text content from relevant columns (reference, value, alias)
            const cells = row.querySelectorAll('td');
            const reference = cells[0]?.textContent.toLowerCase() || '';
            const value = cells[1]?.textContent.toLowerCase() || '';
            const alias = cells[2]?.textContent.toLowerCase() || '';
            const padName = cells[5]?.textContent.toLowerCase() || '';
            const padAlias = cells[6]?.textContent.toLowerCase() || '';

            // Check if search term matches any of the relevant fields
            const matches = reference.includes(searchTerm) || 
                          value.includes(searchTerm) || 
                          alias.includes(searchTerm) ||
                          padName.includes(searchTerm) ||
                          padAlias.includes(searchTerm);

            row.style.display = matches ? '' : 'none';
        });

        this.addDebugLog(`Parts search: "${searchTerm}" - ${this.getVisibleRowCount('partsTable')} results`, 'info');
    }

    searchNets(searchTerm) {
        const netsTable = document.getElementById('jsonNetsTable');
        const tbody = netsTable.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr');

        searchTerm = searchTerm.toLowerCase().trim();

        rows.forEach(row => {
            if (!searchTerm) {
                // Show all rows if search is empty
                row.style.display = '';
                return;
            }

            // Get text content from relevant columns (name, alias)
            const cells = row.querySelectorAll('td');
            const name = cells[0]?.textContent.toLowerCase() || '';
            const alias = cells[1]?.textContent.toLowerCase() || '';

            // Check if search term matches any of the relevant fields
            const matches = name.includes(searchTerm) || alias.includes(searchTerm);

            row.style.display = matches ? '' : 'none';
        });

        this.addDebugLog(`Nets search: "${searchTerm}" - ${this.getVisibleRowCount('jsonNetsTable')} results`, 'info');
    }

    getVisibleRowCount(tableId) {
        const table = document.getElementById(tableId);
        const tbody = table.querySelector('tbody');
        const visibleRows = tbody.querySelectorAll('tr:not([style*="display: none"])');
        return visibleRows.length;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pcbEditor = new PCBFileEditor();
});
