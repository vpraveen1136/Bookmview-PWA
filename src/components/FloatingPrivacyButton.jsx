import { PrivacyEyeButton } from './PrivacyEyeButton.jsx';

/** WhatsApp-style floating privacy control on source tabs. */
export function FloatingPrivacyButton() {
  return (
    <div className="floating-privacy-fab">
      <PrivacyEyeButton className="floating-privacy-fab-btn" compact />
    </div>
  );
}
