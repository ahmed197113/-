// أزرار الإدخال السريع للأعضاء: من جهات الاتصال، أو لصق قائمة أسماء
import { useState } from 'react';
import { L } from '../../lib/i18n';
import { num } from '../../lib/format';
import { canPickContacts, pickContacts } from '../../lib/native';
import { parsePeopleList, toIntl, type PersonEntry } from '../../lib/people';
import { Icon } from './Icon';
import { toastError } from './ui';

export function QuickPeople({ country, onAdd }: { country: string; onAdd: (people: PersonEntry[]) => void }) {
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const parsed = parsePeopleList(text, country);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="btns">
        {canPickContacts() && (
          <button
            type="button"
            className="btn soft"
            onClick={async () => {
              try {
                const picked = await pickContacts();
                if (picked.length) onAdd(picked.map((c) => ({ name: c.name || c.phone, phone: toIntl(c.phone, country), units: 1 })));
              } catch (e) {
                toastError(e);
              }
            }}
          >
            <Icon name="users" /> {L('من جهات الاتصال', 'From contacts')}
          </button>
        )}
        <button type="button" className="btn soft" onClick={() => setPaste((x) => !x)}>
          <Icon name="copy" /> {L('لصق قائمة أسماء', 'Paste a list')}
        </button>
      </div>
      {paste && (
        <div className="card tight stack" style={{ gap: 8 }}>
          <textarea
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={L('اسم في كل سطر، والرقم اختياري:\nمحمد 0501234567\nسارة 0552223333\nخالد نصف سهم', 'One per line, phone optional:\nAli 0501234567\nSara half')}
            aria-label={L('قائمة الأعضاء', 'Members list')}
          />
          <button
            type="button"
            className="btn block"
            disabled={!parsed.length}
            onClick={() => {
              onAdd(parsed);
              setText('');
              setPaste(false);
            }}
          >
            <Icon name="plus" /> {L(`إضافة ${num(parsed.length)} أعضاء`, `Add ${parsed.length} members`)}
          </button>
        </div>
      )}
    </div>
  );
}
