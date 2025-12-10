# XML Table Editor

A powerful VS Code extension for viewing and editing XML files as interactive tables. Transform your structured XML data into a familiar spreadsheet-like interface with Excel-style navigation, multi-cell selection, and comprehensive keyboard shortcuts.

## ✨ Features

### 📊 Table View & Multi-Worksheet Support
- **Visual table interface** - View XML data as organized, editable tables instead of raw XML text
- **Multi-worksheet support** - Manage multiple data tables within a single XML file with easy tab switching
- **Excel-style column headers** (A, B, C...) for intuitive navigation and reference
- **Responsive layout** - Tables automatically adapt to your VS Code window size

### ⌨️ Advanced Keyboard Navigation
- **Arrow keys** - Move between cells freely in all directions
- **Tab/Shift+Tab** - Navigate left/right between cells with familiar spreadsheet behavior
- **Enter key** - Enter edit mode for the current cell
- **Shift+Arrow keys** - Extend selection to form rectangular blocks (like Excel)
- **Shift+Click** - Select rectangular regions between two cells for bulk operations
- **Ctrl+Home/End** - Jump to first/last cell in table (when implemented)

### ✂️ Comprehensive Cell & Data Editing
- **Single-cell editing** - Click any cell to edit, type to replace content
- **Multi-cell operations** - Select multiple cells and perform bulk actions:
  - **Delete** - Clear contents of selected cells
  - **Cut (Ctrl+X)** - Move data to internal clipboard and clear original location
  - **Copy (Ctrl+C)** - Copy to system clipboard without clearing
  - **Paste (Ctrl+V)** - Paste from system clipboard
- **Add rows/columns** - Interactive dialogs to add custom numbers of rows or columns
- **Move rows/columns** - Right-click context menus to reorganize your data
- **Rename columns** - Customize column headers for better organization
- **Delete rows/columns** - Remove unwanted data with context menus

### 🧮 Mathematical Content & KaTeX Support
- **KaTeX rendering** - Display mathematical expressions using `$...$` delimiters
- **Toggle math mode** - Enable/disable math rendering with a convenient checkbox in the toolbar
- **Line breaks in math** - Use `\\` in text to create new lines, properly handled in rendered mode
- **Quick math wrapping** - Select text in edit mode and press `$` to wrap with `$...$` delimiters
- **Professional typography** - Render complex equations, subscripts, superscripts, and mathematical symbols

### 🎨 User Experience & Customization
- **Responsive table sizing** - Adjust column widths and row heights by dragging dividers
- **Context menus** - Right-click on columns/rows for quick actions and options
- **Clipboard separation** - Internal cut/paste (Ctrl+X/V) doesn't interfere with system clipboard
- **Dark mode support** - Seamlessly follows VS Code's theme and color settings
- **Frozen rows/columns** - Keep headers visible while scrolling through large datasets
- **Worksheet management** - Add new worksheets, rename them, and switch between them easily

## 🚀 Installation

### From VS Code Extension Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "XML Table Editor"
4. Click Install

### From VSIX File
```bash
code --install-extension xml-table-editor-0.0.2.vsix
```

## 📖 Usage Guide

### Opening XML Files
1. Open any `.xml` file in VS Code
2. The extension automatically activates and displays the table view
3. Your XML data is instantly transformed into an editable table

### Basic Cell Operations
```
Click A1                    → Select cell A1 (blue highlight)
Type "hello"               → Automatically enter edit mode with "hello"
Press Enter or click B1    → Save and move to next cell
Press Escape               → Cancel editing without saving changes
```

### Multi-Cell Selection & Bulk Operations
```
Select A1                  → Click cell A1
Shift+Right, Down          → Extend to B2 (creates 2x2 selection block)
Press Delete               → Clear all selected cells
Shift+Click on D4          → Select rectangular block A1:D4
Ctrl+X                     → Cut all selected cells
```

### Adding & Managing Data
- **+ Row button** - Opens dialog to add multiple rows at once
- **+ Col button** - Opens dialog to add multiple columns at once
- **Right-click column** - Move, rename, or delete columns
- **Right-click row** - Move or delete rows
- **Freeze controls** - Lock rows/columns from scrolling

### Working with Math Content
Enable the **"Render Math"** checkbox to see KaTeX equations:
```
Input:  $\log_{3}10 \approx 2.096$
Output: Rendered mathematical notation
```

Quick math wrapping while editing:
```
Select "test"              → Text is highlighted
Press $                    → Becomes "$test$" (wrapped with delimiters)
```

Line breaks in math mode:
```
Input:  First line \\ Second line
Output: First line
        Second line
(Extra spaces removed automatically)
```

## ⌨️ Complete Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Arrow Keys** | Move selection up/down/left/right |
| **Shift + Arrow** | Extend selection to form blocks |
| **Shift + Click** | Select rectangular region |
| **Tab** | Move to next cell (right) |
| **Shift + Tab** | Move to previous cell (left) |
| **Enter** | Enter edit mode (or move down if editing) |
| **Escape** | Cancel editing, revert changes |
| **Delete** | Clear selected cell(s) |
| **Backspace** | Clear selected cell(s) |
| **Ctrl+X** | Cut selection (internal clipboard) |
| **Ctrl+C** | Copy selection (system clipboard) |
| **Ctrl+V** | Paste (system clipboard) |
| **$ (while editing)** | Wrap selected text with `$...$` |

## 📁 File Format Support

Works with any XML file containing tabular data:

### Supported Structures
- **Custom XML** - Generic repeating elements with data
- **Office Open XML** - Excel files (`.xlsx`), Word documents (`.docx`)
- **Database exports** - XML exports from databases and other tools
- **Configuration files** - Structured XML configuration data

### Example XML Structure
```xml
<Spreadsheet>
  <Worksheet name="Sheet1">
    <Row>
      <Column>Header1</Column>
      <Column>Header2</Column>
    </Row>
    <Row>
      <Column>Data1</Column>
      <Column>Data2</Column>
    </Row>
  </Worksheet>
</Spreadsheet>
```

## 💡 Tips & Tricks

### Productivity Tips
1. **Bulk editing** - Select multiple cells with Shift+Arrow or Shift+Click, then cut/delete all at once
2. **Column organization** - Use right-click menus to move columns without manual copy/paste
3. **Math heavy content** - Use KaTeX rendering for documents with equations
4. **Large datasets** - Use freeze rows/columns to keep context while scrolling

### Best Practices
- **Regular saves** - Use Ctrl+S to save changes back to XML
- **Backups** - Keep backups of important XML files before bulk editing
- **Column freezing** - Freeze header rows when working with large tables
- **Worksheet organization** - Use multiple worksheets to organize related data

## 🔧 Technical Details

### Architecture
- **Custom Text Editor Provider** - Extends VS Code's custom editor API
- **TypeScript** - Built with type-safe TypeScript
- **Webview** - Uses VS Code webview for table rendering
- **XML Parsing** - `fast-xml-parser` for efficient XML parsing/generation
- **Math Rendering** - KaTeX for mathematical expression display

### Dependencies
- `fast-xml-parser` - Fast and reliable XML parsing
- `katex` - Mathematical expression rendering (auto-render extension)

## ⚙️ Requirements

- **VS Code** 1.60 or higher
- **No additional system dependencies**

## 🐛 Known Limitations

- **Office files** - Excel/Word files are opened in read-only mode (parse and display only)
- **Performance** - Tables with 10,000+ rows may experience slight lag
- **Math syntax** - Requires standard KaTeX-compatible LaTeX syntax
- **XML formats** - Complex nested structures may not display as flat tables

## 🔮 Future Enhancements

Planned features for upcoming releases:
- [ ] Undo/Redo (Ctrl+Z/Y) support with view state preservation
- [ ] Frozen pane improvements for better scrolling experience
- [ ] Find & Replace functionality
- [ ] Export to CSV/Excel format
- [ ] Formula support for computed columns

See [TODO.md](TODO.md) for full development roadmap.

## 🐞 Bug Reports & Feature Requests

Found a bug? Have a feature request? 

Visit the [GitHub repository](https://github.com/LibraryTitan/xml-table-editor) to:
- Report issues
- Request features
- View source code
- Contribute improvements

## 📝 License

MIT License - Feel free to use, modify, and distribute.

## 👨‍💻 Development

### Building from Source
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Package as VSIX
vsce package
```

### Running Tests
```bash
npm test
```

---

**Made with ❤️ for data enthusiasts and spreadsheet lovers**
