import { useState } from 'react';
import { api } from '../api';

const ALLOWED_EXTS = ['.yml', '.dmg', '.exe', '.blockmap'];

export function UploadTab({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  return (
    <form className="form-section" onSubmit={handleUpload}>
      <h3>Upload Update File</h3>
      <p className="hint">Accepted: .yml, .dmg, .exe, .blockmap</p>
      <input
        type="file"
        accept=".yml,.dmg,.exe,.blockmap"
        onChange={e => setFile(e.target.files?.[0] || null)}
      />
      <button type="submit" disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
