import { useState } from 'react';
import { api } from '../api';

const ALLOWED_EXTS = ['.yml', '.dmg', '.exe', '.blockmap'];

export function UploadTab({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Publish form state
  const [version, setVersion] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [sha512, setSha512] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [publishing, setPublishing] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(`Unsupported file type: ${ext}`);
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');
    try {
      const result = await api.uploadFile(token, file.name, file) as { ok: boolean; path: string };
      setMessage(`Uploaded: ${result.path}`);
      setFile(null);
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version.trim() || !downloadUrl.trim()) return;

    setPublishing(true);
    setError('');
    setMessage('');
    try {
      const result = await api.publish(token, {
        version: version.trim(),
        url: downloadUrl.trim(),
        sha512: sha512.trim() || undefined,
        size: fileSize ? parseInt(fileSize, 10) : undefined,
      }) as { ok: boolean; path: string };
      setMessage(`Published: ${result.path} (v${version})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <form className="form-section" onSubmit={handlePublish}>
        <h3>Publish Update (External URL)</h3>
        <p className="hint">Generate latest.yml pointing to a download URL (e.g. company disk server)</p>
        <input
          placeholder="Version (e.g. 26.5.0)"
          value={version}
          onChange={e => setVersion(e.target.value)}
        />
        <input
          placeholder="Download URL (e.g. https://disk.company.com/sman/Sman-Setup-26.5.0.exe)"
          value={downloadUrl}
          onChange={e => setDownloadUrl(e.target.value)}
        />
        <input
          placeholder="SHA512 hash (optional)"
          value={sha512}
          onChange={e => setSha512(e.target.value)}
        />
        <input
          type="number"
          placeholder="File size in bytes (optional)"
          value={fileSize}
          onChange={e => setFileSize(e.target.value)}
        />
        <button type="submit" disabled={publishing || !version.trim() || !downloadUrl.trim()}>
          {publishing ? 'Publishing...' : 'Publish'}
        </button>
      </form>

      <form className="form-section" onSubmit={handleUpload}>
        <h3>Upload File Directly</h3>
        <p className="hint">Upload .yml, .dmg, .exe, .blockmap to this server</p>
        <input
          type="file"
          accept=".yml,.dmg,.exe,.blockmap"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
        <button type="submit" disabled={!file || uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
