import { useEffect, useState } from 'react';
import { sha256, verifyBiometric } from '../../lib/auth';
import { L } from '../../lib/i18n';
import { useDB } from '../../store/db';
import { Icon } from '../components/Icon';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { settings } = useDB();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');

  const bio = async () => {
    if (settings.biometricId && (await verifyBiometric(settings.biometricId))) onUnlock();
  };
  useEffect(() => {
    if (settings.biometricId) bio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (pin.length < 4) return;
    sha256(pin).then((h) => {
      if (h === settings.pinHash) onUnlock();
      else {
        setErr(L('الرمز غير صحيح، حاول مرة أخرى', 'Wrong PIN, try again'));
        setPin('');
      }
    });
  }, [pin, settings.pinHash, onUnlock]);

  return (
    <div className="lock">
      <div className="empty" style={{ padding: 0 }}>
        <div className="ic">
          <Icon name="lock" size={34} />
        </div>
        <strong style={{ fontSize: '1.2rem' }}>{L('جمعيتي مقفلة', 'Jamiyati is locked')}</strong>
        <span className="small">{settings.pinHash ? L('أدخل رمزك المكوّن من 4 أرقام', 'Enter your 4-digit PIN') : L('استخدم البصمة للفتح', 'Use biometrics to unlock')}</span>
      </div>
      {settings.pinHash && (
        <>
          <div className="pindots" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className={i < pin.length ? 'on' : ''} />
            ))}
          </div>
          {err && <div className="error small">{err}</div>}
          <div className="pinpad" dir="ltr">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'].map((k) =>
              k === 'bio' ? (
                settings.biometricId ? (
                  <button key={k} onClick={bio} aria-label={L('البصمة', 'Biometrics')}>
                    <Icon name="fingerprint" size={28} />
                  </button>
                ) : (
                  <span key={k} />
                )
              ) : k === 'del' ? (
                <button key={k} onClick={() => setPin((p) => p.slice(0, -1))} aria-label={L('حذف', 'Delete')}>
                  ⌫
                </button>
              ) : (
                <button key={k} onClick={() => { setErr(''); setPin((p) => (p + k).slice(0, 4)); }}>
                  {k}
                </button>
              ),
            )}
          </div>
        </>
      )}
      {!settings.pinHash && settings.biometricId && (
        <button className="btn" onClick={bio}>
          <Icon name="fingerprint" /> {L('فتح بالبصمة', 'Unlock')}
        </button>
      )}
    </div>
  );
}
