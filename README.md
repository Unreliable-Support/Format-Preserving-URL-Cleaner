# Format-Preserving URL Cleaner

A powerful Chrome extension designed to clean up messy URLs copied from Google search results or other sources, without destroying your rich text formatting.

Have you ever copied a link with bold or italic text, only to have a simple find-and-replace tool wipe out all your formatting? This extension solves that problem. It intelligently targets *only the text content* for cleanup, leaving the surrounding HTML structure (like `<b>`, `<i>`, `<a>` tags) completely intact.

*(Recommendation: Create a short GIF showing the extension cleaning a link inside a `contenteditable` area like Google Docs or Notion, and replace this text with it.)*
`![Demo GIF](demo.gif)`

## Key Features

-   **Preserves Rich Text Formatting**: The core feature. It safely cleans URLs inside formatted text (bold, italics, different fonts, etc.) without breaking the style.
-   **Context Menu Integration**: Simply select text, right-click, and choose "Clean Selected Text" to run the cleanup.
-   **Smart Cleanup Rules**:
    -   Removes Google's redirect prefix (`www.google.com/url?...`).
    -   Decodes URL-encoded characters like `%2F` back into `/`.
-   **Works Everywhere**:
    -   **Rich Text Editors**: Perfect for use in web apps like Google Docs, Notion, Trello, and `contenteditable` fields.
    -   **Standard Text Fields**: Works flawlessly in simple `<textarea>` and `<input>` elements.
    -   **Static Web Pages**: Can clean text selected anywhere on a page.
-   **Modern & Secure**: Built on Manifest V3 with minimal, necessary permissions (`contextMenus`, `scripting`, `activeTab`).

## How It Works (Technical Details)

Unlike basic extensions that use `innerHTML.replace()`, which destroys existing DOM nodes and formatting, this tool uses a more sophisticated approach:

1.  **Detects Context**: It first checks if the selection is inside a simple text input or a rich text area.
2.  **For Rich Text**: It uses a `document.createTreeWalker` to traverse the selected DOM nodes.
3.  **Targets Text Nodes**: The TreeWalker is configured to visit *only text nodes* within the selection.
4.  **Precise Modification**: The cleanup patterns are applied directly to the `nodeValue` of these text nodes.

This ensures that only the raw text is altered, while the HTML elements that provide formatting are never touched.

## Installation

You can install this extension in any Chromium-based browser (like Google Chrome, Microsoft Edge, Brave) by following these steps:

1.  **Download the code:**
    -   Clone the repository:
        ```bash
        git clone https://github.com/Unreliable-Support/Format-Preserving-URL-Cleaner.git
        ```
    -   Or, download the ZIP file and extract it to a folder on your computer.

2.  **Open your browser's extensions page:**
    -   Navigate to `chrome://extensions` in your browser.

3.  **Enable Developer Mode:**
    -   In the top-right corner of the extensions page, turn on the **"Developer mode"** toggle switch.

4.  **Load the extension:**
    -   Click the **"Load unpacked"** button that appears.
    -   In the file selection dialog, choose the folder where you cloned or extracted the project files (the folder that contains `manifest.json`).

The "Format-Preserving URL Cleaner" extension will now be available in your right-click menu.

## Usage

1.  On any webpage, select a piece of text containing a messy URL (e.g., `www.google.com/url?sa=E&q=https%3A%2F%2Fgithub.com`).
2.  Right-click on your selection.
3.  Click **"Clean Selected Text (Preserve Formatting)"**.
4.  The text will be instantly cleaned to `https://github.com` while keeping any original bold, italics, or other styles.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.