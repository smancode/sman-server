import { useState, useEffect } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';

const ALLOWED_EXTS = ['.yml', '.dmg', '.exe', '.blockmap'];

export function UploadTab() {
  const token = useAuthStore((s) => s.token);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useLocale();

  const [version, setVersion] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [sha512, setSha512] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [ymlPreview, setYmlPreview] = useState('');

  useEffect(() => {
    api.getLatestYml(token).then(setYmlPreview).catch(() => {});
  }, [token]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(t('upload.unsupportedType', { ext }));
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');
    try {
      const result = await api.uploadFile(token, file.name, file) as { ok: boolean; path: string; yml?: string; sha512?: string; version?: string; size: number };
      if (result.yml) {
        setMessage(t('upload.uploadedWithYml', {
          path: result.path,
          size: String(result.size),
          version: result.version || '',
          sha512: result.sha512?.substring(0, 16) || '',
        }));
        setYmlPreview(result.yml);
      } else {
        setMessage(t('upload.uploaded', { path: result.path, size: String(result.size) }));
      }
      setFile(null);
    } catch {
      setError(t('upload.uploadFailed'));
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
        releaseNotes: releaseNotes.trim() || undefined,
      }) as { ok: boolean; path: string; yml: string };
      setMessage(t('upload.published', { path: result.path, version }));
      if (result.yml) setYmlPreview(result.yml);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('upload.publishFailed'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.upload')}</h2>
      </div>

      <div className="forms-row">
        <form className="form-section" onSubmit={handlePublish}>
          <h3>{t('upload.publishTitle')}</h3>
          <p className="hint">{t('upload.publishHint')}</p>
          <input
            placeholder={t('upload.versionPlaceholder')}
            value={version}
            onChange={e => setVersion(e.target.value)}
          />
          <input
            placeholder={t('upload.urlPlaceholder')}
            value={downloadUrl}
            onChange={e => setDownloadUrl(e.target.value)}
          />
          <input
            placeholder={t('upload.shaPlaceholder')}
            value={sha512}
            onChange={e => setSha512(e.target.value)}
          />
          <input
            type="number"
            placeholder={t('upload.sizePlaceholder')}
            value={fileSize}
            onChange={e => setFileSize(e.target.value)}
          />
          <textarea
            placeholder={t('upload.notesPlaceholder')}
            value={releaseNotes}
            onChange={e => setReleaseNotes(e.target.value)}
            rows={4}
          />
          <button className="btn-primary" type="submit" disabled={publishing || !version.trim() || !downloadUrl.trim()}>
            {publishing ? t('upload.publishing') : t('upload.publish')}
          </button>
        </form>

        <form className="form-section" onSubmit={handleUpload}>
          <h3>{t('upload.uploadTitle')}</h3>
          <p className="hint">{t('upload.uploadHint')}</p>
          <input
            type="file"
            accept=".yml,.dmg,.exe,.blockmap"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
          <button className="btn-primary" type="submit" disabled={!file || uploading}>
            {uploading ? t('upload.uploading') : t('upload.upload')}
          </button>
        </form>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {ymlPreview && (
        <div className="form-section">
          <h3>{t('upload.currentYml')}</h3>
          <pre className="yml-preview">{ymlPreview}</pre>
        </div>
      )}
    </div>
  );
}
