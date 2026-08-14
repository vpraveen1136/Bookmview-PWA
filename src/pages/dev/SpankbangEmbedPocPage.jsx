/**
 * TEMP POC — delete this file when embed testing is done.
 * Tests official SpankBang /embed/ iframe inside the PWA shell (no DB / playability).
 */
import { Link } from 'react-router-dom';

export const SPANKBANG_EMBED_POC_URL = 'https://spankbang.com/a50kv/embed/';

export function SpankbangEmbedPocPage() {
  return (
    <div className="spankbang-embed-poc">
      <header className="spankbang-embed-poc-header">
        <Link to="/dashboard" className="btn spankbang-embed-poc-back">
          ← Back
        </Link>
        <h1 className="spankbang-embed-poc-title">SPBG embed POC</h1>
      </header>

      <p className="spankbang-embed-poc-note">
        Temporary test only. Official embed URL:
        <code className="spankbang-embed-poc-url">{SPANKBANG_EMBED_POC_URL}</code>
      </p>

      <div className="spankbang-embed-poc-frame-wrap">
        <iframe
          className="spankbang-embed-poc-frame"
          src={SPANKBANG_EMBED_POC_URL}
          title="SpankBang embed POC (a50kv)"
          frameBorder="0"
          scrolling="no"
          width="100%"
          height="100%"
          allow="fullscreen; autoplay"
          allowFullScreen
        />
      </div>
    </div>
  );
}
