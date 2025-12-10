import * as vscode from 'vscode';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export class XmlTableEditorProvider implements vscode.CustomTextEditorProvider {

    public static readonly viewType = 'xml-table-editor.editor';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new XmlTableEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(XmlTableEditorProvider.viewType, provider);
        return providerRegistration;
    }

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = { enableScripts: true };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        let isUpdatingDocument = false;  // Track if we're the source of document changes
        let lastWrittenXml = '';  // Track the last XML we wrote

        function updateWebview() {
            const text = document.getText();
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_",
                isArray: (name, jpath, isLeafNode, isAttribute) => false
            });
            
            try {
                const jsonObj = parser.parse(text);
                webviewPanel.webview.postMessage({
                    type: 'updateJson',
                    data: jsonObj,
                    isInternalUpdate: isUpdatingDocument  // Pass flag to webview
                });
            } catch (e) {
                console.error("Error parsing XML", e);
            }
        }

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                const currentText = document.getText();
                // If we're updating the document, send the flag to webview before clearing it
                if (isUpdatingDocument) {
                    updateWebview();  // This will include isInternalUpdate: true
                    lastWrittenXml = currentText;  // Update what we think we wrote
                    isUpdatingDocument = false;
                } else if (currentText !== lastWrittenXml) {
                    // Only reload if the content actually changed (external modification)
                    updateWebview();
                    lastWrittenXml = currentText;
                }
                // If content is the same, do nothing (user just saved our own changes)
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // When the webview becomes visible, update it
        webviewPanel.onDidChangeViewState(e => {
            if (e.webviewPanel.visible && !isUpdatingDocument) {
                updateWebview();
            }
        });

        webviewPanel.webview.onDidReceiveMessage(e => {
            if (e.type === 'updateDocument') {
                isUpdatingDocument = true;
                // Build XML to track what we're writing
                const builder = new XMLBuilder({
                    format: true,
                    ignoreAttributes: false,
                    attributeNamePrefix: "@_",
                    indentBy: "  "
                });
                try {
                    lastWrittenXml = builder.build(e.json);
                } catch (error) {
                    console.error('Failed to build XML preview', error);
                }
                this.updateTextDocument(document, e.json);
            }
        });

        updateWebview();
        lastWrittenXml = document.getText();  // Initialize with current file contents
    }

    private updateTextDocument(document: vscode.TextDocument, jsonContent: any) {
        const builder = new XMLBuilder({
            format: true,
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            indentBy: "  "
        });
        try {
            const xmlContent = builder.build(jsonContent);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
                document.uri,
                new vscode.Range(0, 0, document.lineCount, 0),
                xmlContent
            );
            vscode.workspace.applyEdit(edit);
        } catch (error) {
            console.error('Failed to convert back to XML', error);
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; sandbox allow-modals allow-scripts;">
                
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>

                <style>
                    :root { --border-color: var(--vscode-panel-border); --bg-color: var(--vscode-editor-background); --header-bg: var(--vscode-button-secondaryBackground); --header-fg: var(--vscode-button-secondaryForeground); --hover-bg: var(--vscode-list-hoverBackground); --select-bg: rgba(0, 120, 212, 0.2); --select-border: #0078d4; }
                    body { font-family: 'Segoe UI', sans-serif; padding: 0; background-color: var(--bg-color); color: var(--vscode-editor-foreground); display: flex; flex-direction: column; height: 100vh; margin: 0; user-select: none; }
                    
                    /* Toolbar */
                    .toolbar { display: flex; align-items: center; background-color: var(--vscode-editorGroupHeader-tabsBackground); border-bottom: 1px solid var(--border-color); padding: 5px 10px; gap: 10px; flex-shrink: 0; }
                    .tab-bar-container { overflow-x: auto; flex-grow: 1; border-right: 1px solid var(--border-color); padding-right: 10px; display: flex; align-items: center; }
                    .tab-bar { display: flex; }
                    .tab { padding: 6px 12px; cursor: pointer; border-right: 1px solid var(--border-color); white-space: nowrap; color: var(--vscode-tab-inactiveForeground); font-size: 13px; border-radius: 3px; }
                    .tab:hover { background-color: var(--hover-bg); }
                    .tab.active { background-color: var(--bg-color); color: var(--vscode-tab-activeForeground); font-weight: bold; box-shadow: 0 2px 0 var(--vscode-tab-activeBorderTop) inset; }
                    
                    .tab-add-btn { background: none; border: none; color: var(--header-fg); cursor: pointer; font-size: 16px; padding: 0 8px; display: flex; align-items: center; justify-content: center; }
                    .tab-add-btn:hover { color: var(--vscode-tab-activeForeground); background-color: var(--hover-bg); border-radius: 3px; }

                    .btn-group { display: flex; gap: 5px; align-items: center; }
                    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; cursor: pointer; font-size: 12px; border-radius: 2px; }
                    button:hover { background: var(--vscode-button-hoverBackground); }
                    .toggle-label { font-size: 12px; user-select: none; display: flex; align-items: center; gap: 5px; }

                    #table-wrapper { flex-grow: 1; overflow: auto; padding: 0; position: relative; outline: none; }
                    table { border-collapse: separate; border-spacing: 0; table-layout: fixed; width: max-content; }
                    th, td { border: 1px solid var(--border-color); padding: 0; text-align: left; vertical-align: top; }
                    
                    /* Drag Styles */
                    th { background-color: var(--header-bg); color: var(--header-fg); position: sticky; top: 0; z-index: 10; font-weight: 600; cursor: grab; transition: background 0.1s; }
                    th:active { cursor: grabbing; }
                    th.drag-over { background-color: var(--select-border); color: white; opacity: 0.8; }
                    
                    .header-content { padding: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }
                    .col-resizer { position: absolute; right: 0; top: 0; bottom: 0; width: 5px; cursor: col-resize; z-index: 20; }
                    .col-resizer:hover { background-color: var(--vscode-focusBorder); }

                    .row-num { text-align: center; color: var(--header-fg); background-color: var(--header-bg); font-size: 11px; font-weight: 600; border-right: 1px solid var(--border-color); min-width: 40px; vertical-align: middle; position: sticky !important; left: 0 !important; z-index: 14; cursor: default; }
                    .row-num.frozen-row { top: 58px !important; z-index: 14 !important; }
                    .row-num.frozen-header-row { top: 29px !important; z-index: 14 !important; }
                    .row-resizer { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; cursor: row-resize; z-index: 20; }
                    .row-resizer:hover { background-color: var(--vscode-focusBorder); }
                    th:first-child { z-index: 20; left: 0; cursor: default; }
                    
                    /* Frozen rows and columns */
                    /* Intersection cells (both frozen row and frozen column) - highest priority */
                    td.frozen-header-col { position: sticky; top: 29px; z-index: 13; background-color: var(--header-bg) !important; }
                    td.frozen-both { position: sticky; top: 58px; z-index: 13; background-color: var(--header-bg) !important; }
                    
                    /* Single frozen row */
                    td.frozen-header-row { position: sticky; top: 29px; z-index: 10; background-color: var(--header-bg) !important; }
                    td.frozen-row { position: sticky; top: 58px; z-index: 10; background-color: var(--header-bg) !important; }
                    
                    /* Single frozen column */
                    td.frozen-col { position: sticky; z-index: 12; background-color: var(--header-bg) !important; }

                    .cell-div { padding: 4px; min-height: 28px; height: 100%; box-sizing: border-box; overflow: hidden; white-space: pre-wrap; cursor: cell; border: 2px solid transparent; }
                    .cell-div.selected { background-color: var(--select-bg); border-color: var(--select-border); }
                    
                    textarea.cell-editor { display: block; width: 100%; min-height: 28px; background: var(--vscode-input-background); color: inherit; border: 2px solid var(--select-border); outline: none; font-family: inherit; font-size: 13px; resize: none; padding: 4px; box-sizing: border-box; position: relative; z-index: 50; }

                    /* Info Message */
                    #info-msg { display: none; text-align: center; align-items: center; justify-content: center; }
                    #info-msg.visible { display: flex !important; }

                    /* Modals */
                    #modal-overlay, #move-modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 3000; justify-content: center; align-items: center; }
                    .modal-box { background: var(--bg-color); border: 1px solid var(--border-color); padding: 20px; width: 320px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
                    .modal-title { font-weight: bold; margin-bottom: 10px; display: block; }
                    .modal-input, .modal-select { width: 100%; padding: 5px; margin-bottom: 15px; background: var(--vscode-input-background); border: 1px solid var(--vscode-focusBorder); color: inherit; }
                    .modal-btns { display: flex; justify-content: flex-end; gap: 10px; }

                    .context-menu { position: absolute; display: none; background: var(--vscode-menu-background); color: var(--vscode-menu-foreground); border: 1px solid var(--border-color); box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 2000; min-width: 150px; }
                    .context-menu-item { padding: 8px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid var(--border-color); }
                    .context-menu-item:hover { background: var(--vscode-menu-selectionBackground); color: var(--vscode-menu-selectionForeground); }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <div class="tab-bar-container">
                        <div id="tab-bar" class="tab-bar"></div>
                        <button class="tab-add-btn" onclick="addNewWorksheet()" title="Add Worksheet">+</button>
                    </div>
                    <div class="btn-group">
                        <button onclick="addRow()">+ Row</button>
                        <button onclick="addCol()">+ Col</button>
                    </div>
                    <div class="btn-group" style="border-left: 1px solid var(--border-color); padding-left: 10px;">
                        <input type="checkbox" id="math-toggle">
                        <label for="math-toggle" class="toggle-label">Render Math</label>
                    </div>
                </div>
                
                <div id="table-wrapper" tabindex="0">
                    <div id="info-msg" class="info">Loading...</div>
                    <div id="table-container"></div>
                </div>

                <!-- Rename Modal -->
                <div id="modal-overlay">
                    <div class="modal-box">
                        <label class="modal-title">Rename</label>
                        <input type="text" id="modal-input" class="modal-input" placeholder="New Name">
                        <div class="modal-btns">
                            <button onclick="closeModal()">Cancel</button>
                            <button id="modal-submit-btn" onclick="submitRename()">Rename</button>
                        </div>
                    </div>
                </div>

                <!-- Move Column Modal -->
                <div id="move-modal-overlay">
                    <div class="modal-box">
                        <label class="modal-title" id="move-modal-title">Move Column</label>
                        <label style="font-size:12px">Move this column:</label>
                        <select id="move-position" class="modal-select">
                            <option value="before">Before</option>
                            <option value="after">After</option>
                        </select>
                        <label style="font-size:12px">Target Column:</label>
                        <select id="move-target" class="modal-select"></select>
                        <div class="modal-btns">
                            <button onclick="closeMoveModal(); closeMoveRowModal();">Cancel</button>
                            <button onclick="if(pendingMoveRow !== null) submitMoveRow(); else submitMove();">Move</button>
                        </div>
                    </div>
                </div>

                <div id="ctx-menu" class="context-menu"></div>

                <!-- Add Rows/Columns Modal -->
                <div id="add-modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; justify-content: center; align-items: center;">
                    <div class="modal-box">
                        <label class="modal-title" id="add-modal-title">Add Rows</label>
                        <input type="number" id="add-modal-input" class="modal-input" placeholder="Number to add" value="1" min="1">
                        <div class="modal-btns">
                            <button onclick="closeAddModal()">Cancel</button>
                            <button onclick="submitAdd()">Add</button>
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    let currentJson = {};
                    let tables = [];
                    let activeTableIndex = 0;
                    let renderMathMode = false;
                    let colWidths = {}; 
                    let rowHeights = {};
                    let frozenRowsPerTable = {};  // Store frozen rows per table index
                    let frozenColsPerTable = {};  // Store frozen columns per table index
                    
                    let selection = { start: null, end: null };
                    let isDragging = false;
                    let editingLocation = null;
                    let manualColOrder = []; 
                    let pendingRenameCol = null;
                    let pendingMoveCol = null;
                    let pendingMoveRow = null;
                    let lastInternalUpdateTime = 0;  // Track when internal update was initiated
                    let activeTableName = null;  // Preserve active table by name, not just index
                    let tabJustPressed = false;  // Flag to prevent Tab from triggering edit mode
                    let pendingAddType = null;  // 'row' or 'col'
                    let clipboardData = null;  // For cut/paste operations (Ctrl+X/Ctrl+V)
                    
                    // Helper functions to get/set frozen rows/cols per table
                    function getFrozenRows() { return frozenRowsPerTable[activeTableIndex] || 0; }
                    function setFrozenRowsForTable(numRows) { frozenRowsPerTable[activeTableIndex] = numRows; renderActiveTable(); }
                    function getFrozenCols() { return frozenColsPerTable[activeTableIndex] || 0; }
                    function setFrozenColsForTable(numCols) { frozenColsPerTable[activeTableIndex] = numCols; renderActiveTable(); }
                    
                    // Convert column index to Excel-style letters (0->A, 1->B, 25->Z, 26->AA, etc)
                    function getExcelColName(index) {
                        let result = '';
                        let num = index + 1;
                        while (num > 0) {
                            num--;
                            result = String.fromCharCode(65 + (num % 26)) + result;
                            num = Math.floor(num / 26);
                        }
                        return result;
                    }
                    
                    // Custom modal for prompts and confirms (since webview sandbox blocks native dialogs)
                    let modalPromiseResolve = null;
                    
                    // Helper to update document while preserving UI state
                    function updateDocumentInternal(json) {
                        lastInternalUpdateTime = Date.now();
                        vscode.postMessage({ type: 'updateDocument', json: json });
                    }
                    
                    function showCustomModal(title, message, inputValue = '', showCancel = true, isConfirm = false) {
                        return new Promise((resolve) => {
                            modalPromiseResolve = resolve;
                            const modal = document.getElementById('modal-overlay');
                            const titleEl = modal.querySelector('.modal-title');
                            const input = document.getElementById('modal-input');
                            const submitBtn = document.getElementById('modal-submit-btn');
                            
                            titleEl.innerText = title;
                            input.value = inputValue;
                            input.placeholder = message;
                            
                            if (isConfirm) {
                                input.style.display = 'none';
                                submitBtn.innerText = 'OK';
                            } else {
                                input.style.display = 'block';
                                submitBtn.innerText = 'Submit';
                                input.focus();
                            }
                            
                            modal.style.display = 'flex';
                            
                            submitBtn.onclick = () => {
                                const result = isConfirm ? true : input.value.trim();
                                closeModal();
                                resolve(result);
                            };
                        });
                    }

                    document.getElementById('math-toggle').addEventListener('change', (e) => {
                        renderMathMode = e.target.checked;
                        renderActiveTable();
                    });

                    window.addEventListener('message', event => {
                        if (event.data.type === 'updateJson') {
                            currentJson = event.data.data ? event.data.data : event.data;
                            // Check if extension marked this as internal update, or if it's within 2000ms of our update
                            const isInternalUpdate = event.data.isInternalUpdate || (Date.now() - lastInternalUpdateTime) < 2000;
                            // Only reset state if this is an external file load (not our internal update)
                            if (!isInternalUpdate) {
                                activeTableIndex = 0;
                                manualColOrder = [];
                                selection = { start: null, end: null };
                                editingLocation = null;
                                frozenRowsPerTable = {};
                                frozenColsPerTable = {};
                                colWidths = {};
                                rowHeights = {};
                                analyzeData(currentJson);
                                activeTableName = tables.length > 0 ? tables[0].name : null;
                                renderTabs();
                                renderActiveTable();
                            } else {
                                // Internal update: re-analyze to get any new tables, but preserve state
                                const prevTableName = activeTableName;
                                analyzeData(currentJson);
                                // Restore to same table by name
                                if (prevTableName !== null) {
                                    const tableIndex = tables.findIndex(t => t.name === prevTableName);
                                    if (tableIndex !== -1) {
                                        activeTableIndex = tableIndex;
                                        activeTableName = prevTableName;
                                    } else {
                                        // Table was deleted, go to first table
                                        activeTableIndex = 0;
                                        activeTableName = tables.length > 0 ? tables[0].name : null;
                                    }
                                } else {
                                    activeTableIndex = 0;
                                    activeTableName = tables.length > 0 ? tables[0].name : null;
                                }
                                renderTabs();
                                renderActiveTable();
                            }
                        }
                    });

                    // --- CLIPBOARD ---
                    document.addEventListener('copy', (e) => {
                        if (!selection.start || !selection.end) return;
                        if (document.activeElement.tagName === 'TEXTAREA') return;
                        e.preventDefault();
                        const r1 = Math.min(selection.start.r, selection.end.r);
                        const r2 = Math.max(selection.start.r, selection.end.r);
                        const c1 = Math.min(selection.start.c, selection.end.c);
                        const c2 = Math.max(selection.start.c, selection.end.c);
                        const table = tables[activeTableIndex];
                        const TAB = String.fromCharCode(9);
                        const NEWLINE = String.fromCharCode(10);
                        let clipText = "";
                        for (let r = r1; r <= r2; r++) {
                            let rowStr = [];
                            for (let c = c1; c <= c2; c++) {
                                let key = manualColOrder[c];
                                let val = table.data[r][key];
                                if (typeof val === 'object') val = val['#text'] || "";
                                if (val === undefined) val = "";
                                rowStr.push(val);
                            }
                            clipText += rowStr.join(TAB) + (r < r2 ? NEWLINE : "");
                        }
                        e.clipboardData.setData('text/plain', clipText);
                    });

                    document.addEventListener('paste', (e) => {
                        if (document.activeElement.tagName === 'TEXTAREA') return;
                        e.preventDefault();
                        const pasteData = e.clipboardData.getData('text');
                        if (!pasteData) return;
                        let startR = 0, startC = 0;
                        let endR = startR, endC = startC;
                        if (selection.start) {
                            startR = Math.min(selection.start.r, selection.end.r);
                            startC = Math.min(selection.start.c, selection.end.c);
                            endR = Math.max(selection.start.r, selection.end.r);
                            endC = Math.max(selection.start.c, selection.end.c);
                        }
                        const TAB = String.fromCharCode(9);
                        const CR = String.fromCharCode(13);
                        const LF = String.fromCharCode(10);
                        const rows = pasteData.split(new RegExp(CR + '?' + LF + '|' + CR));
                        const table = tables[activeTableIndex];
                        const maxR = table.data.length;
                        const maxC = manualColOrder.length;
                        let changed = false;
                        
                        // Check if it's a single cell paste (single value with no tabs/newlines)
                        const isSingleCell = rows.length === 1 && !rows[0].includes(TAB);
                        
                        if (isSingleCell) {
                            // Paste single value to all selected cells
                            const pasteValue = rows[0];
                            for (let r = startR; r <= endR; r++) {
                                for (let c = startC; c <= endC; c++) {
                                    const key = manualColOrder[c];
                                    table.data[r][key] = pasteValue;
                                    changed = true;
                                }
                            }
                        } else {
                            // Paste as grid (original behavior)
                            rows.forEach((rowStr, rIdx) => {
                                const targetR = startR + rIdx;
                                if (targetR >= maxR) return;
                                const cols = rowStr.split(TAB);
                                cols.forEach((val, cIdx) => {
                                    const targetC = startC + cIdx;
                                    if (targetC >= maxC) return;
                                    const key = manualColOrder[targetC];
                                    table.data[targetR][key] = val;
                                    changed = true;
                                });
                            });
                        }
                        
                        if (changed) {
                            updateDocumentInternal(currentJson);
                            renderActiveTable();
                        }
                    });

                    // --- MOUSE HANDLERS ---
                    const wrapper = document.getElementById('table-wrapper');
                    
                    wrapper.addEventListener('mousedown', (e) => {
                        // Get the closest td element, regardless of what was clicked
                        const td = e.target.closest('td');
                        if (!td) return;
                        if (e.target.tagName === 'TEXTAREA') return;
                        
                        const r = parseInt(td.dataset.r);
                        const c = parseInt(td.dataset.c);
                        // If we're editing, commit the edit first (without auto-entering edit mode on new cell)
                        if (editingLocation) {
                            commitEdit(0, 0, true);  // true = skipEditing
                        }
                        isDragging = true;
                        selection.start = { r, c };
                        selection.end = { r, c };
                        updateSelectionVisuals();
                    });

                    wrapper.addEventListener('mouseup', (e) => {
                        isDragging = false;
                    });

                    wrapper.addEventListener('mousemove', (e) => {
                        if (isDragging) {
                            const td = e.target.closest('td');
                            if (td && td.dataset.r) {
                                const r = parseInt(td.dataset.r);
                                const c = parseInt(td.dataset.c);
                                selection.end = { r, c };
                                updateSelectionVisuals();
                            }
                        }
                    });

                    document.addEventListener('mouseup', () => { isDragging = false; });

                    // Capture Tab key at document level before VS Code can intercept it
                    document.addEventListener('keydown', (e) => {
                        if (!editingLocation && selection.start) {
                            if (e.key === 'Tab') {
                                e.preventDefault();
                                e.stopPropagation();
                                moveSelection(e.shiftKey ? 'ArrowLeft' : 'ArrowRight');
                                // Block wrapper keydown handler for 100ms to prevent accidental edit mode
                                tabJustPressed = true;
                                setTimeout(() => { tabJustPressed = false; }, 100);
                            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                                // Character input when not editing - enter edit mode with that character
                                e.preventDefault();
                                startEditing(selection.start.r, selection.start.c, e.key);
                            }
                        }
                    }, true); // Use capture phase to intercept before other handlers

                    wrapper.addEventListener('dblclick', (e) => {
                        if (editingLocation) return;
                        const td = e.target.closest('td');
                        if (td && td.dataset.r) {
                            startEditing(parseInt(td.dataset.r), parseInt(td.dataset.c));
                        }
                    });

                    wrapper.addEventListener('keydown', (e) => {
                        if (editingLocation) return;
                        if (tabJustPressed) return;  // Skip if Tab was just pressed
                        if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelection(); e.preventDefault(); return; }
                        if (e.key === 'Enter') { e.preventDefault(); if (selection.start) startEditing(selection.start.r, selection.start.c); return; }
                        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); moveSelection(e.key); return; }
                        // Cut: Ctrl+X
                        if ((e.ctrlKey || e.metaKey) && e.key === 'x') { e.preventDefault(); cutSelection(); return; }
                        // Paste: Ctrl+V (custom clipboard, not system clipboard)
                        if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteSelection(); return; }
                        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { if (selection.start) { startEditing(selection.start.r, selection.start.c, e.key); e.preventDefault(); } }
                    });

                    function updateSelectionVisuals() {
                        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                        if (!selection.start || !selection.end) return;
                        const r1 = Math.min(selection.start.r, selection.end.r);
                        const r2 = Math.max(selection.start.r, selection.end.r);
                        const c1 = Math.min(selection.start.c, selection.end.c);
                        const c2 = Math.max(selection.start.c, selection.end.c);
                        for(let r = r1; r <= r2; r++) {
                            for(let c = c1; c <= c2; c++) {
                                const td = document.querySelector('td[data-r="' + r + '"][data-c="' + c + '"] .cell-div');
                                if (td) td.classList.add('selected');
                            }
                        }
                    }

                    function moveSelection(key) {
                        if (!selection.start) return;
                        let r = selection.start.r, c = selection.start.c;
                        if (key === 'ArrowUp') r--;
                        if (key === 'ArrowDown') r++;
                        if (key === 'ArrowLeft') c--;
                        if (key === 'ArrowRight') c++;
                        
                        const table = tables[activeTableIndex];
                        if (!table || !table.data) return;
                        const maxR = table.data.length - 1, maxC = manualColOrder.length - 1;
                        if (r < 0) r = 0; if (r > maxR) r = maxR;
                        if (c < 0) c = 0; if (c > maxC) c = maxC;

                        selection.start = { r, c }; selection.end = { r, c };
                        updateSelectionVisuals();
                        const el = document.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]');
                        if(el) el.scrollIntoView({block: "nearest", inline: "nearest"});
                    }

                    function startEditing(r, c, initialValueOverride = null) {
                        if (tabJustPressed) return;  // Prevent edit mode if Tab was just pressed
                        const td = document.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]');
                        if (!td) return;
                        const table = tables[activeTableIndex];
                        const row = table.data[r];
                        const key = manualColOrder[c];
                        let val = row[key];
                        if (val === undefined) val = "";
                        if (typeof val === 'object') val = val['#text'] || "";

                        td.innerHTML = '';
                        const area = document.createElement('textarea');
                        area.className = 'cell-editor';
                        area.value = initialValueOverride !== null ? initialValueOverride : val;
                        
                        area.addEventListener('blur', () => commitEdit());
                        area.addEventListener('keydown', (e) => {
                            if (tabJustPressed && e.key === 'Tab') return;  // Ignore Tab if it was just pressed
                            
                            // Wrap selection with $ when $ is pressed
                            if (e.key === '$') {
                                const start = area.selectionStart;
                                const end = area.selectionEnd;
                                if (start !== end) {  // There's a selection
                                    e.preventDefault();
                                    const selectedText = area.value.substring(start, end);
                                    const wrappedText = '$' + selectedText + '$';
                                    area.value = area.value.substring(0, start) + wrappedText + area.value.substring(end);
                                    // Place cursor after the wrapped text
                                    area.selectionStart = area.selectionEnd = start + wrappedText.length;
                                }
                            }
                            
                            if (e.key === 'Escape') { 
                                e.preventDefault(); 
                                const { r, c } = editingLocation;
                                editingLocation = null; 
                                renderActiveTable();
                                wrapper.focus(); 
                            }
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); commitEdit(1, 0, true); }
                            if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); commitEdit(0, e.shiftKey ? -1 : 1); }
                        });

                        td.appendChild(area);
                        area.focus();
                        
                        // Auto-expand textarea to fit content
                        const autoExpandTextarea = () => {
                            area.style.height = 'auto';
                            const tdRect = td.getBoundingClientRect();
                            const wrapperRect = wrapper.getBoundingClientRect();
                            const availableHeight = wrapperRect.bottom - tdRect.top - 10;
                            const newHeight = Math.min(area.scrollHeight, availableHeight);
                            area.style.height = newHeight + 'px';
                        };
                        
                        autoExpandTextarea();
                        area.addEventListener('input', autoExpandTextarea);
                        
                        editingLocation = { r, c };
                    }

                    function commitEdit(moveR = 0, moveC = 0, skipEditing = false) {
                        if (!editingLocation) return;
                        const { r, c } = editingLocation;
                        const td = document.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]');
                        const area = td ? td.querySelector('textarea') : null;
                        
                        if (area) {
                            const newVal = area.value;
                            const table = tables[activeTableIndex];
                            const row = table.data[r];
                            const key = manualColOrder[c];
                            row[key] = newVal;
                            updateDocumentInternal(currentJson);
                        }
                        editingLocation = null;
                        renderActiveTable();

                        if (moveR !== 0 || moveC !== 0) {
                            let nextR = r + moveR, nextC = c + moveC;
                            if (moveR === 1 && nextR >= tables[activeTableIndex].data.length) {
                                addRow();
                                requestAnimationFrame(() => {
                                    selection.start = { r: nextR, c: nextC };
                                    selection.end = { r: nextR, c: nextC };
                                    updateSelectionVisuals();
                                    // Scroll to the new cell
                                    const el = document.querySelector('td[data-r="' + nextR + '"][data-c="' + nextC + '"]');
                                    if(el) el.scrollIntoView({block: "nearest", inline: "nearest"});
                                    wrapper.focus();
                                });
                                return;
                            }
                            if (nextR >= 0 && nextC >= 0 && nextC < manualColOrder.length) {
                                selection.start = { r: nextR, c: nextC };
                                selection.end = { r: nextR, c: nextC };
                                updateSelectionVisuals();
                                // Scroll to the new cell after DOM is ready - use requestAnimationFrame for proper timing
                                if (!skipEditing) {
                                    requestAnimationFrame(() => {
                                        const el = document.querySelector('td[data-r="' + nextR + '"][data-c="' + nextC + '"]');
                                        if(el) el.scrollIntoView({block: "nearest", inline: "nearest"});
                                        startEditing(nextR, nextC);
                                    });
                                } else {
                                    requestAnimationFrame(() => {
                                        const el = document.querySelector('td[data-r="' + nextR + '"][data-c="' + nextC + '"]');
                                        if(el) el.scrollIntoView({block: "nearest", inline: "nearest"});
                                        wrapper.focus();
                                    });
                                }
                            }
                        } else {
                            selection.start = { r, c }; selection.end = { r, c };
                            updateSelectionVisuals();
                        }
                    }

                    function deleteSelection() {
                        if (!selection.start || !selection.end) return;
                        const r1 = Math.min(selection.start.r, selection.end.r);
                        const r2 = Math.max(selection.start.r, selection.end.r);
                        const c1 = Math.min(selection.start.c, selection.end.c);
                        const c2 = Math.max(selection.start.c, selection.end.c);
                        const table = tables[activeTableIndex];
                        for(let r = r1; r <= r2; r++) {
                            for(let c = c1; c <= c2; c++) {
                                table.data[r][manualColOrder[c]] = "";
                            }
                        }
                        updateDocumentInternal(currentJson);
                        renderActiveTable();
                    }

                    function cutSelection() {
                        if (!selection.start || !selection.end) return;
                        const r1 = Math.min(selection.start.r, selection.end.r);
                        const r2 = Math.max(selection.start.r, selection.end.r);
                        const c1 = Math.min(selection.start.c, selection.end.c);
                        const c2 = Math.max(selection.start.c, selection.end.c);
                        const table = tables[activeTableIndex];
                        
                        // Store the data in clipboard
                        clipboardData = {
                            rows: r2 - r1 + 1,
                            cols: c2 - c1 + 1,
                            data: []
                        };
                        
                        for(let r = r1; r <= r2; r++) {
                            const row = [];
                            for(let c = c1; c <= c2; c++) {
                                const key = manualColOrder[c];
                                row.push(table.data[r][key] || "");
                            }
                            clipboardData.data.push(row);
                        }
                        
                        // Clear the selection
                        deleteSelection();
                    }

                    function pasteSelection() {
                        if (!clipboardData || !selection.start) return;
                        const table = tables[activeTableIndex];
                        const startR = selection.start.r;
                        const startC = selection.start.c;
                        
                        // Paste data from clipboard
                        for(let r = 0; r < clipboardData.data.length; r++) {
                            const targetR = startR + r;
                            if (targetR >= table.data.length) {
                                // Add new row if needed
                                let newRow = {};
                                if(table.data.length > 0) {
                                    Object.keys(table.data[0]).forEach(k => { if(!k.startsWith('@_')) newRow[k] = ""; });
                                }
                                table.data.push(newRow);
                            }
                            
                            for(let c = 0; c < clipboardData.data[r].length; c++) {
                                const targetC = startC + c;
                                if (targetC < manualColOrder.length) {
                                    const key = manualColOrder[targetC];
                                    table.data[targetR][key] = clipboardData.data[r][c];
                                }
                            }
                        }
                        
                        updateDocumentInternal(currentJson);
                        renderActiveTable();
                        
                        // Clear clipboard after paste (like cut/paste behavior)
                        clipboardData = null;
                    }

                    // --- RENDER ---
                    function renderActiveTable() {
                        const container = document.getElementById('table-container');
                        const infoMsg = document.getElementById('info-msg');
                        
                        container.innerHTML = '';
                        if (tables.length === 0 || activeTableIndex >= tables.length) {
                            // Check if it's an Office format error (infoMsg will already be styled with color/bgcolor)
                            if (!infoMsg.style.backgroundColor || infoMsg.style.backgroundColor === '') {
                                infoMsg.classList.add('visible');
                                infoMsg.innerHTML = 'Loading...';
                            }
                            return;
                        }
                        
                        infoMsg.classList.remove('visible');

                        const currentTable = tables[activeTableIndex];
                        const rowData = currentTable.data;
                        const widths = colWidths[activeTableIndex] || {};
                        const heights = rowHeights[activeTableIndex] || {};

                        const table = document.createElement('table');
                        const thead = document.createElement('thead');
                        const tbody = document.createElement('tbody');

                        const uniqueKeys = new Set();
                        rowData.forEach(r => {
                            if(typeof r === 'object') Object.keys(r).forEach(k => { if(!k.startsWith('@_') && k!=='#text') uniqueKeys.add(k); });
                        });
                        const detectedKeys = Array.from(uniqueKeys);

                        if (manualColOrder.length === 0) {
                            manualColOrder = detectedKeys;
                        } else {
                            detectedKeys.forEach(k => { if(!manualColOrder.includes(k)) manualColOrder.push(k); });
                        }

                        // HEADER - Excel style column letters
                        const headerRow = document.createElement('tr');
                        const corner = document.createElement('th');
                        corner.style.width = '40px'; 
                        corner.innerText = '';
                        headerRow.appendChild(corner);

                        manualColOrder.forEach((key, i) => {
                            const th = document.createElement('th');
                            if(widths[i]) th.style.width = widths[i] + 'px'; else th.style.width = '150px'; 

                            const content = document.createElement('div');
                            content.className = 'header-content';
                            content.innerText = getExcelColName(i); 
                            th.appendChild(content);

                            const resizer = document.createElement('div');
                            resizer.className = 'col-resizer';
                            initColResize(resizer, th, i);
                            th.appendChild(resizer);

                            th.oncontextmenu = (e) => showCtxMenu(e, 'col', i, key);

                            headerRow.appendChild(th);
                        });
                        thead.appendChild(headerRow);

                        // BODY - Data rows start at row 1 (no header row for generic XML)
                        rowData.forEach((row, rIndex) => {
                            const tr = document.createElement('tr');
                            if(heights[rIndex]) tr.style.height = heights[rIndex] + 'px';

                            const rowNumTd = document.createElement('td');
                            rowNumTd.className = 'row-num';
                            // Apply frozen row styling to row number cell
                            if (getFrozenRows() > rIndex) {
                                rowNumTd.classList.add('frozen-row');
                            }
                            rowNumTd.innerText = rIndex + 1;
                            rowNumTd.oncontextmenu = (e) => showCtxMenu(e, 'row', rIndex);
                            const rr = document.createElement('div');
                            rr.className = 'row-resizer';
                            initRowResize(rr, tr, rIndex);
                            rowNumTd.appendChild(rr);
                            tr.appendChild(rowNumTd);

                            manualColOrder.forEach((key, cIndex) => {
                                const td = document.createElement('td');
                                td.dataset.r = rIndex; td.dataset.c = cIndex;
                                td.oncontextmenu = (e) => showCtxMenu(e, 'cell', rIndex, cIndex);
                                
                                // Apply frozen row/col styling
                                const isFrozenRow = getFrozenRows() > rIndex;
                                const isFrozenCol = getFrozenCols() > cIndex;
                                if (isFrozenRow && isFrozenCol) {
                                    td.className = 'frozen-both';
                                } else if (isFrozenRow) {
                                    td.className = 'frozen-row';
                                } else if (isFrozenCol) {
                                    td.className = 'frozen-col';
                                }
                                
                                let val = row[key];
                                if (val === undefined) val = "";
                                if (typeof val === 'object') val = val['#text'] || JSON.stringify(val);
                                val = String(val);

                                const div = document.createElement('div');
                                div.className = 'cell-div';
                                if (renderMathMode && (val.includes('$') || val.includes('\\\\'))) {
                                    // Keep the original value for KaTeX parsing
                                    div.innerText = val;
                                    if(val.includes('\\\\') && !val.includes('$')) div.innerText = '$' + val + '$';
                                    try { if(typeof renderMathInElement !== 'undefined') renderMathInElement(div, {delimiters: [{left:'$', right:'$', display:false}]}); } catch(e){}
                                    // After KaTeX renders, replace \\ with line breaks and remove surrounding spaces
                                    const htmlContent = div.innerHTML;
                                    div.innerHTML = htmlContent.replace(/\s*\\\\\s*/g, '<br>');
                                } else {
                                    div.innerText = val;
                                }
                                td.appendChild(div);
                                tr.appendChild(td);
                            });
                            tbody.appendChild(tr);
                        });

                        table.appendChild(thead);
                        table.appendChild(tbody);
                        container.appendChild(table);
                        
                        // Calculate and apply frozen column positions
                        if (getFrozenCols() > 0) {
                            const widths = colWidths[activeTableIndex] || {};
                            let leftPos = 40; // Start after row number column
                            
                            // For each frozen column, calculate its left position and set it on all cells in that column
                            for (let cIndex = 0; cIndex < getFrozenCols(); cIndex++) {
                                const colWidth = parseInt(widths[cIndex] || '150');
                                // Find all cells (data cells and header cells) in this column that are frozen
                                const selector = 'td[data-c="' + cIndex + '"].frozen-col, td[data-c="' + cIndex + '"].frozen-both';
                                const frozenCellsInCol = document.querySelectorAll(selector);
                                frozenCellsInCol.forEach(cell => {
                                    cell.style.left = leftPos + 'px';
                                });
                                leftPos += colWidth + 1; // +1 for border
                            }
                        }
                        
                        updateSelectionVisuals();
                    }

                    // --- MENUS & MODALS ---
                    function showCtxMenu(e, type, arg1, arg2) {
                        e.preventDefault();
                        const menu = document.getElementById('ctx-menu');
                        menu.innerHTML = ''; menu.style.display = 'block';
                        
                        if(type === 'row') { 
                            const rowIndex = arg1;
                            
                            const item = document.createElement('div');
                            item.className = 'context-menu-item';
                            item.innerText = 'Delete Row ' + (rowIndex+1); 
                            item.onclick = () => deleteRow(rowIndex);
                            menu.appendChild(item);
                            
                            const moveItem = document.createElement('div');
                            moveItem.className = 'context-menu-item';
                            moveItem.innerText = 'Move Row';
                            moveItem.onclick = () => openMoveRowModal(rowIndex);
                            menu.appendChild(moveItem);
                            
                            const freezeItem = document.createElement('div');
                            freezeItem.className = 'context-menu-item';
                            // rowIndex is 0-based, freeze up to and including the clicked row
                            if (getFrozenRows() < rowIndex + 1) {
                                freezeItem.innerText = 'Freeze Rows Above';
                                freezeItem.onclick = () => setFrozenRowsForTable(rowIndex + 1);
                            } else {
                                freezeItem.innerText = 'Unfreeze Rows';
                                freezeItem.onclick = () => setFrozenRowsForTable(0);
                            }
                            menu.appendChild(freezeItem);
                        } else if (type === 'cell') {
                            const rIndex = arg1;
                            const cIndex = arg2;
                            const item = document.createElement('div');
                            item.className = 'context-menu-item';
                            item.innerText = 'Paste Transposed';
                            item.onclick = () => pasteTransposed(rIndex, cIndex);
                            menu.appendChild(item);
                        } else if (type === 'col') { 
                            const colIndex = arg1;
                            const keyName = arg2;
                            let item = document.createElement('div');
                            item.className = 'context-menu-item'; item.innerText = 'Rename: ' + keyName; item.onclick = () => openRenameModal(keyName); menu.appendChild(item);
                            item = document.createElement('div');
                            item.className = 'context-menu-item'; item.innerText = 'Move Column'; item.onclick = () => openMoveModal(keyName); menu.appendChild(item);
                            item = document.createElement('div');
                            item.className = 'context-menu-item'; item.innerText = 'Delete Column'; item.onclick = () => deleteCol(keyName); menu.appendChild(item);
                            
                            const freezeItem = document.createElement('div');
                            freezeItem.className = 'context-menu-item';
                            if (getFrozenCols() <= colIndex) {
                                freezeItem.innerText = 'Freeze Columns Left';
                                freezeItem.onclick = () => setFrozenColsForTable(colIndex + 1);
                            } else {
                                freezeItem.innerText = 'Unfreeze Columns';
                                freezeItem.onclick = () => setFrozenColsForTable(0);
                            }
                            menu.appendChild(freezeItem);
                        } else if (type === 'tab') {
                            const index = arg1;
                            let item = document.createElement('div');
                            item.className = 'context-menu-item'; item.innerText = 'Rename Worksheet'; item.onclick = () => renameWorksheet(index); menu.appendChild(item);
                            item = document.createElement('div');
                            item.className = 'context-menu-item'; item.innerText = 'Delete Worksheet'; item.onclick = () => deleteWorksheet(index); menu.appendChild(item);
                        }
                        
                        // Clamp menu position to viewport bounds
                        const menuRect = menu.getBoundingClientRect();
                        let x = e.pageX;
                        let y = e.pageY;
                        
                        // Clamp horizontal position
                        if (x + menuRect.width > window.innerWidth) {
                            x = window.innerWidth - menuRect.width - 5;
                        }
                        if (x < 0) x = 5;
                        
                        // Clamp vertical position
                        if (y + menuRect.height > window.innerHeight) {
                            y = window.innerHeight - menuRect.height - 5;
                        }
                        if (y < 0) y = 5;
                        
                        menu.style.left = x + 'px';
                        menu.style.top = y + 'px';
                    }

                    // -- RENAME MODAL --
                    function openRenameModal(oldName) {
                        document.getElementById('ctx-menu').style.display = 'none';
                        pendingRenameCol = oldName;
                        document.getElementById('modal-input').value = oldName;
                        document.getElementById('modal-overlay').style.display = 'flex';
                        document.getElementById('modal-input').focus();
                        
                        // Default handler
                        document.getElementById('modal-submit-btn').onclick = submitRename;
                    }
                    function closeModal() { 
                        document.getElementById('modal-overlay').style.display = 'none';
                        const input = document.getElementById('modal-input');
                        input.style.display = 'block'; // Reset for next use
                    }
                    
                    function closeAddModal() {
                        document.getElementById('add-modal-overlay').style.display = 'none';
                        pendingAddType = null;
                    }
                    
                    function submitAdd() {
                        const input = document.getElementById('add-modal-input');
                        const count = parseInt(input.value);
                        if (isNaN(count) || count <= 0) {
                            return;
                        }
                        
                        if (pendingAddType === 'row') {
                            const t = tables[activeTableIndex];
                            for (let i = 0; i < count; i++) {
                                let newRow = {};
                                if(t.data.length > 0) Object.keys(t.data[0]).forEach(k => { if(!k.startsWith('@_')) newRow[k] = ""; });
                                else newRow = { "NewColumn": "" };
                                t.data.push(newRow);
                            }
                            updateDocumentInternal(currentJson); 
                            renderActiveTable();
                        } else if (pendingAddType === 'col') {
                            const t = tables[activeTableIndex];
                            let i = 1, base = "NewColumn";
                            let existing = (t.data.length > 0) ? Object.keys(t.data[0]) : [];
                            for (let n = 0; n < count; n++) {
                                while(existing.includes(base+i)) i++;
                                let newKey = base+i;
                                existing.push(newKey);
                                manualColOrder.push(newKey);
                                if(t.data.length === 0) t.data.push({ [newKey]: "" });
                                else t.data.forEach(row => { row[newKey] = ""; });
                                i++;
                            }
                            updateDocumentInternal(currentJson); 
                            renderActiveTable();
                        }
                        
                        closeAddModal();
                    }
                    function submitRename() {
                        const newName = document.getElementById('modal-input').value.trim();
                        if (!newName || newName.includes(' ')) { alert('Invalid Name'); return; }
                        const table = tables[activeTableIndex];
                        table.data.forEach(row => {
                            const val = row[pendingRenameCol];
                            const ordered = {};
                            Object.keys(row).forEach(k => {
                                if (k === pendingRenameCol) ordered[newName] = val;
                                else ordered[k] = row[k];
                            });
                            Object.keys(row).forEach(k => delete row[k]);
                            Object.assign(row, ordered);
                        });
                        const idx = manualColOrder.indexOf(pendingRenameCol);
                        if(idx !== -1) manualColOrder[idx] = newName;
                        closeModal();
                        updateDocumentInternal(currentJson);
                        renderActiveTable();
                    }

                    // -- WORKSHEET FUNCTIONS --
                    function renameWorksheet(index) {
                        const table = tables[index];
                        document.getElementById('ctx-menu').style.display = 'none';
                        document.getElementById('modal-input').value = table.name;
                        document.getElementById('modal-overlay').style.display = 'flex';
                        document.getElementById('modal-input').focus();
                        
                        // Override Submit for Worksheet
                        document.getElementById('modal-submit-btn').onclick = () => {
                            const newName = document.getElementById('modal-input').value.trim();
                            if(!newName) return;
                            
                            if (table.type === 'excel' && table.rawSheet) {
                                table.rawSheet['@_ss:Name'] = newName;
                            } else {
                                const path = table.path;
                                if (path && path.length > 0) {
                                    const oldKey = path[path.length - 1];
                                    let parent = currentJson;
                                    for(let i=0; i<path.length-1; i++) parent = parent[path[i]];
                                    if (parent[oldKey]) {
                                        parent[newName] = parent[oldKey];
                                        delete parent[oldKey];
                                    }
                                }
                            }
                            closeModal();
                            updateDocumentInternal(currentJson);
                        };
                    }

                    window.deleteWorksheet = async function(index) {
                        const confirmed = await showCustomModal('Delete Worksheet', 'Delete this worksheet permanently?', '', true, true);
                        if (!confirmed) return;
                        
                        const table = tables[index];
                        const path = table.path; // e.g. ['MathCourseData', 'KeyConcepts', 'Concept']

                        // Helper to traverse JSON safely
                        function getObj(base, p) {
                            let cur = base;
                            for (let i = 0; i < p.length; i++) {
                                if (cur === undefined) return undefined;
                                cur = cur[p[i]];
                            }
                            return cur;
                        }

                        if (path && path.length > 0) {
                            // 1. Delete the specific Array (the rows)
                            const parentPath = path.slice(0, -1);
                            const keyToDelete = path[path.length - 1]; // e.g., 'Concept'
                            const parentObj = getObj(currentJson, parentPath);

                            if (parentObj) {
                                delete parentObj[keyToDelete];

                                // 2. Clean up the Parent Container if it's now empty
                                // (e.g. remove <KeyConcepts> if it has no children left)
                                if (path.length >= 2) {
                                    // Check if parent has any REAL children left (ignoring attributes like @_id)
                                    const remainingKeys = Object.keys(parentObj).filter(k => !k.startsWith('@_'));
                                    
                                    if (remainingKeys.length === 0) {
                                        // Parent is empty, delete it from Grandparent
                                        const grandParentPath = path.slice(0, -2);
                                        const parentKey = path[path.length - 2]; // e.g., 'KeyConcepts'
                                        const grandParentObj = getObj(currentJson, grandParentPath);
                                        
                                        if (grandParentObj) {
                                            delete grandParentObj[parentKey];
                                        }
                                    }
                                }
                            }
                        }

                        // Adjust active tab if we deleted the current one
                        if (activeTableIndex >= index && activeTableIndex > 0) activeTableIndex--;
                        
                        updateDocumentInternal(currentJson);
                        analyzeData(currentJson);
                        renderTabs();
                        renderActiveTable();
                    };

                    window.addNewWorksheet = async function() {
                        console.log('addNewWorksheet called');
                        const rootKeys = Object.keys(currentJson);
                        console.log('rootKeys:', rootKeys);
                        if (rootKeys.length === 0) {
                            console.log('No root keys found');
                            return;
                        }
                        const rootKey = rootKeys[0];
                        const rootObj = currentJson[rootKey];
                        console.log('rootKey:', rootKey);
                        console.log('rootObj:', rootObj);
                        
                        // 1. Get Container Name (e.g., 'KeyConcepts')
                        const containerName = await showCustomModal('Add Worksheet', 'Enter new worksheet/container name:', 'NewContainer');
                        if (!containerName) return;
                        
                        // 2. Get Row Element Name (e.g., 'Concept')
                        const rowName = await showCustomModal('Add Row Type', 'Enter row element name:', 'Item');
                        if (!rowName) return;

                        // 3. Check if container already exists at root level
                        if (rootObj[containerName]) {
                            alert('A section with this name already exists.');
                            return;
                        }

                        // 4. Create the new container with array of items
                        // IMPORTANT: Must have at least 2 items so parser detects it as an array
                        rootObj[containerName] = {
                            [rowName]: [ 
                                { "Col1": "Data" },
                                { "Col1": "Data" } 
                            ]
                        };

                        console.log('Added new worksheet:', containerName);
                        
                        // 5. Update the document and refresh UI
                        updateDocumentInternal(currentJson);
                        analyzeData(currentJson);
                        renderTabs();
                        renderActiveTable();
                    };

                    // -- PASTE TRANSPOSED --
                    function pasteTransposed(startR, startC) {
                        try {
                            const clipboardText = navigator.clipboard.readText();
                            if (!clipboardText) return;
                            
                            clipboardText.then(text => {
                                const table = tables[activeTableIndex];
                                const maxR = table.data.length;
                                const maxC = manualColOrder.length;
                                let changed = false;
                                
                                // Split the clipboard by newlines to get vertical cells
                                const LF = String.fromCharCode(10);
                                const CR = String.fromCharCode(13);
                                const verticalCells = text.split(new RegExp(CR + '?' + LF + '|' + CR)).filter(line => line.trim() !== '');
                                
                                // Paste each vertical cell horizontally
                                verticalCells.forEach((val, cIdx) => {
                                    const targetC = startC + cIdx;
                                    if (targetC >= maxC) return;
                                    const key = manualColOrder[targetC];
                                    table.data[startR][key] = val.trim();
                                    changed = true;
                                });
                                
                                if (changed) {
                                    updateDocumentInternal(currentJson);
                                    renderActiveTable();
                                }
                            });
                        } catch (err) {
                            console.error('Could not read clipboard:', err);
                        }
                    }

                    // -- MOVE MODAL --
                    function openMoveModal(colName) {
                        if (editingLocation) commitEdit();  // Close any active cell editor
                        document.getElementById('ctx-menu').style.display = 'none';
                        pendingMoveCol = colName;
                        document.getElementById('move-modal-title').innerText = "Move: " + colName;
                        const targetSelect = document.getElementById('move-target');
                        targetSelect.innerHTML = '';
                        manualColOrder.forEach(key => {
                            if (key !== colName) {
                                const opt = document.createElement('option');
                                opt.value = key; opt.innerText = key; targetSelect.appendChild(opt);
                            }
                        });
                        document.getElementById('move-modal-overlay').style.display = 'flex';
                    }
                    function closeMoveModal() { document.getElementById('move-modal-overlay').style.display = 'none'; }
                    function openMoveRowModal(rowIndex) {
                        if (editingLocation) commitEdit();  // Close any active cell editor
                        document.getElementById('ctx-menu').style.display = 'none';
                        pendingMoveRow = rowIndex;
                        document.getElementById('move-modal-title').innerText = "Move Row " + (rowIndex + 1);
                        const targetSelect = document.getElementById('move-target');
                        targetSelect.innerHTML = '';
                        const table = tables[activeTableIndex];
                        for (let i = 0; i < table.data.length; i++) {
                            if (i !== rowIndex) {
                                const opt = document.createElement('option');
                                opt.value = i;
                                opt.innerText = "Row " + (i + 1);
                                targetSelect.appendChild(opt);
                            }
                        }
                        document.getElementById('move-modal-overlay').style.display = 'flex';
                    }
                    function closeMoveRowModal() { document.getElementById('move-modal-overlay').style.display = 'none'; }
                    function submitMoveRow() {
                        const targetRowIndex = parseInt(document.getElementById('move-target').value);
                        const position = document.getElementById('move-position').value;
                        if (isNaN(targetRowIndex)) { closeMoveRowModal(); return; }

                        const table = tables[activeTableIndex];
                        const rowToMove = table.data.splice(pendingMoveRow, 1)[0];
                        const insertIndex = (position === 'after') ? targetRowIndex + 1 : targetRowIndex;
                        table.data.splice(insertIndex, 0, rowToMove);

                        closeMoveRowModal();
                        updateDocumentInternal(currentJson);
                        renderActiveTable();
                    }
                    function submitMove() {
                        const targetCol = document.getElementById('move-target').value;
                        const position = document.getElementById('move-position').value;
                        if (!targetCol) { closeMoveModal(); return; }

                        const currentIndex = manualColOrder.indexOf(pendingMoveCol);
                        manualColOrder.splice(currentIndex, 1);
                        const targetIndex = manualColOrder.indexOf(targetCol);
                        const insertIndex = (position === 'after') ? targetIndex + 1 : targetIndex;
                        manualColOrder.splice(insertIndex, 0, pendingMoveCol);

                        // Fix Data Order In-Place
                        const table = tables[activeTableIndex];
                        for(let i=0; i<table.data.length; i++) {
                            const row = table.data[i];
                            const ordered = {};
                            Object.keys(row).forEach(k => { if(k.startsWith('@_')) ordered[k] = row[k]; });
                            manualColOrder.forEach(k => { ordered[k] = row[k]; });
                            Object.keys(row).forEach(k => delete row[k]);
                            Object.assign(row, ordered);
                        }

                        closeMoveModal();
                        updateDocumentInternal(currentJson);
                        renderActiveTable();
                    }

                    // --- CRUD ---
                    function deleteRow(index) {
                        tables[activeTableIndex].data.splice(index, 1);
                        updateDocumentInternal(currentJson); renderActiveTable();
                    }
                    function deleteCol(keyName) {
                        const table = tables[activeTableIndex];
                        table.data.forEach(row => { delete row[keyName]; });
                        manualColOrder = manualColOrder.filter(k => k !== keyName);
                        updateDocumentInternal(currentJson); renderActiveTable();
                    }
                    window.addRow = function() {
                        if (tables.length === 0) return;
                        if (editingLocation) commitEdit();  // Close any active cell editor
                        pendingAddType = 'row';
                        document.getElementById('add-modal-title').innerText = 'Add Rows';
                        document.getElementById('add-modal-input').value = '1';
                        document.getElementById('add-modal-overlay').style.display = 'flex';
                        document.getElementById('add-modal-input').focus();
                        document.getElementById('add-modal-input').select();
                    }
                    window.addCol = function() {
                         if (tables.length === 0) return;
                         if (editingLocation) commitEdit();  // Close any active cell editor
                         pendingAddType = 'col';
                         document.getElementById('add-modal-title').innerText = 'Add Columns';
                         document.getElementById('add-modal-input').value = '1';
                         document.getElementById('add-modal-overlay').style.display = 'flex';
                         document.getElementById('add-modal-input').focus();
                         document.getElementById('add-modal-input').select();
                    }

                    // --- HELPERS ---
                    function isOfficeXmlFormat(json) {
                        // Check if this is an Office XML format (mso-application="Excel.Sheet")
                        // These files have Workbook and Worksheet elements instead of custom XML structures
                        if (json.Workbook || json.Worksheet) return true;
                        // Check for Office namespace markers
                        const keys = Object.keys(json);
                        return keys.some(k => k.startsWith('@_') && (k.includes('mso') || k.includes('xmlns')));
                    }
                    function analyzeData(json) { 
                        tables = [];
                        const infoMsg = document.getElementById('info-msg');
                        
                        // Clear any previous styling/messages
                        infoMsg.classList.remove('visible');
                        infoMsg.style.color = '';
                        infoMsg.style.backgroundColor = '';
                        infoMsg.style.padding = '';
                        infoMsg.style.borderRadius = '';
                        infoMsg.style.border = '';
                        infoMsg.innerHTML = 'Loading...';
                        
                        if (isOfficeXmlFormat(json)) {
                            // Show error message for Office XML format
                            infoMsg.classList.add('visible');
                            infoMsg.style.color = '#d97706';
                            infoMsg.style.backgroundColor = '#fef3c7';
                            infoMsg.style.padding = '20px';
                            infoMsg.style.borderRadius = '4px';
                            infoMsg.style.border = '2px solid #d97706';
                            infoMsg.innerHTML = '<strong>⚠️ Incompatible Format Detected</strong><br><br>This file appears to have been opened and modified by Microsoft Office XML editor, which converted it to Office proprietary Excel XML format.<br><br>This format is no longer compatible with this extension.<br><br><strong>Solution:</strong> Please restore from your backup file or convert the data back to the original custom XML format.';
                            return;
                        }
                        discoverGenericTables(json);
                        
                        // If no tables found, create a default 5x5 empty table
                        if (tables.length === 0) {
                            const defaultData = [];
                            for (let i = 0; i < 5; i++) {
                                const row = {};
                                for (let j = 0; j < 5; j++) {
                                    row['col' + (j + 1)] = '';
                                }
                                defaultData.push(row);
                            }
                            tables.push({ name: 'Sheet1', data: defaultData, path: ['Sheet1'] });
                            
                            // Update the current JSON with the default table
                            currentJson.Sheet1 = defaultData;
                            updateDocumentInternal(currentJson);
                        }
                    }
                    function discoverGenericTables(obj, path = []) {
                        if (Array.isArray(obj)) {
                            if (obj.length > 0 && typeof obj[0] === 'object') {
                                let name = path.length > 0 ? path[path.length - 1] : 'Table';
                                if (path.length > 1) name = path[path.length - 1]; 
                                tables.push({ name: name, data: obj, path: path });
                            }
                            obj.forEach(item => { if (typeof item === 'object') Object.keys(item).forEach(k => { if (!k.startsWith('@_')) discoverGenericTables(item[k], [...path, k]); }); });
                            return;
                        }
                        if (typeof obj === 'object' && obj !== null) { Object.keys(obj).forEach(k => { if (!k.startsWith('@_')) discoverGenericTables(obj[k], [...path, k]); }); }
                    }
                    function renderTabs() {
                        const tabBar = document.getElementById('tab-bar');
                        tabBar.innerHTML = '';
                        if (tables.length === 0) return;
                        tables.forEach((table, index) => {
                            const tab = document.createElement('div');
                            tab.className = 'tab';
                            
                            // Just mark active. Do NOT reset variables here.
                            if (index === activeTableIndex) tab.classList.add('active'); 
                            
                            tab.innerText = table.name;
                            tab.oncontextmenu = (e) => showCtxMenu(e, 'tab', index);
                            
                            // On Click: Switch tab AND reset column order explicitly
                            tab.onclick = () => { 
                                activeTableIndex = index; 
                                activeTableName = table.name;
                                manualColOrder = []; // Reset only on click
                                renderTabs(); 
                                renderActiveTable(); 
                            };
                            tabBar.appendChild(tab);
                        });
                    }
                    document.addEventListener('click', (e) => { if (!e.target.closest('#ctx-menu')) document.getElementById('ctx-menu').style.display = 'none'; });
                    function initColResize(resizer, th, colIndex) {
                        let startX, startWidth;
                        resizer.addEventListener('mousedown', (e) => { e.stopPropagation(); startX = e.clientX; startWidth = th.offsetWidth; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); });
                        function onMouseMove(e) { th.style.width = (startWidth + (e.clientX - startX)) + 'px'; colWidths[activeTableIndex] = colWidths[activeTableIndex] || {}; colWidths[activeTableIndex][colIndex] = th.offsetWidth; }
                        function onMouseUp() { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
                    }
                    function initRowResize(resizer, tr, rowIndex) {
                        let startY, startHeight;
                        resizer.addEventListener('mousedown', (e) => { e.stopPropagation(); startY = e.clientY; startHeight = tr.offsetHeight; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); });
                        function onMouseMove(e) { tr.style.height = (startHeight + (e.clientY - startY)) + 'px'; rowHeights[activeTableIndex] = rowHeights[activeTableIndex] || {}; rowHeights[activeTableIndex][rowIndex] = tr.offsetHeight; }
                        function onMouseUp() { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
                    }
                </script>
            </body>
            </html>
        `;
    }
}
