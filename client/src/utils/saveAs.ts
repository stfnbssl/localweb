// Avvia un download lato browser con "Salva con nome": dove possibile usa
// showSaveFilePicker per far scegliere all'utente il percorso; in fallback
// (Firefox/Safari) ricade sul classico <a download>.
export async function saveAs(
  suggestedName: string,
  content: string
): Promise<void> {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const w = window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName: string;
      types: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'File Markdown',
            accept: { 'text/markdown': ['.md'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
      // Altro errore: cade nel fallback sotto.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
