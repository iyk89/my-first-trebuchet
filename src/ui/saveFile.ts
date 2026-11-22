/**
 * Offer a file to the viewer. Inside a Claude page this goes through Claude's save prompt
 * (plain downloads are blocked there); in a normal browser it's an ordinary download.
 * Returns a short message to show.
 */
export async function saveFile(filename: string, data: string | Uint8Array, mime: string): Promise<string> {
  const claude = (window as any).claude;
  if (claude?.use) {
    const downloads = await claude.use('downloads');
    if (!downloads) return "Saving files isn't available here. Open the page on claude.ai to download.";
    try {
      await downloads.save({ filename, data });
      return 'Saved.';
    } catch (e: any) {
      if (e?.code === 'declined') return 'Not saved.';
      if (e?.code === 'rate_limited') return 'A save is already waiting for you. Finish that one first.';
      return "Couldn't save the file here. Try again on claude.ai in a browser.";
    }
  }
  const blob = new Blob([data as BlobPart], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'Downloaded.';
}
