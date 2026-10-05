/**
 * Saves text as a file through the browser's download flow.
 *
 * @param fileName - Name the browser suggests for the file.
 * @param text - File contents.
 * @param mimeType - Content type, including the charset for text formats.
 */
export const saveTextFile = (fileName: string, text: string, mimeType: string): void => {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};
