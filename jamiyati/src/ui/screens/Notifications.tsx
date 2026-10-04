import { useEffect, useState } from 'react';
import { L } from '../../lib/i18n';
import { dateTime } from '../../lib/format';
import * as A from '../../store/actions';
import { useDB } from '../../store/db';
import { Icon } from '../components/Icon';
import { Empty, toast, TopBar } from '../components/ui';
import { go } from '../router';
import { isNative, notificationPermission, requestNotifications } from '../../lib/native';

const ICON = { reminder: 'clock', proof: 'receipt', turn: 'star', summary: 'chart', swap: 'swap', info: 'bell' } as const;

export function Notifications() {
  const db = useDB();
  const mine = db.notifications.filter((n) => n.userId === db.currentUserId).sort((a, b) => b.at.localeCompare(a.at));
  const [perm, setPerm] = useState(notificationPermission());
  const unread = mine.filter((n) => !n.read).length;
  // تُعلَّم كمقروءة عند مغادرة الشاشة
  useEffect(() => () => A.markAllRead(), []);

  return (
    <>
      <TopBar
        title={L('الإشعارات', 'Notifications')}
        actions={
          unread > 0 && (
            <button className="btn sm ghost" onClick={() => A.markAllRead()}>
              {L('قراءة الكل', 'Mark all read')}
            </button>
          )
        }
      />
      <main>
        {perm !== 'granted' && (perm === 'default' || isNative()) && (
          <div className="card row">
            <span className="avatar">
              <Icon name="bell" />
            </span>
            <div className="grow small">{L('فعّل الإشعارات لتصلك التذكيرات حتى والتطبيق مغلق.', 'Enable notifications to get reminders even when the app is closed.')}</div>
            <button
              className="btn sm"
              onClick={async () => {
                const p = await requestNotifications();
                setPerm(p);
                if (p === 'granted') toast(L('تم تفعيل الإشعارات ✓', 'Notifications enabled ✓'));
              }}
            >
              {L('تفعيل', 'Enable')}
            </button>
          </div>
        )}
        {mine.length === 0 ? (
          <div className="card">
            <Empty icon="bell" title={L('لا إشعارات بعد', 'No notifications yet')} text={L('ستظهر هنا تذكيرات الأقساط ودورك في الاستلام وطلبات التأكيد.', 'Reminders, turns and approvals will show up here.')} />
          </div>
        ) : (
          <section className="card list">
            {mine.map((n) => (
              <button key={n.id} className="item" onClick={() => n.circleId && go(`/c/${n.circleId}`)} style={{ alignItems: 'flex-start' }}>
                <span className={`avatar sm ${n.kind === 'reminder' && n.text.includes(L('متأخر', 'late')) ? 's-late' : n.kind === 'proof' ? 's-pending' : n.kind === 'turn' ? 's-gold' : ''}`}>
                  <Icon name={ICON[n.kind]} size={16} />
                </span>
                <span className="grow">
                  <span className="small" style={{ fontWeight: n.read ? 400 : 700 }}>
                    {n.text}
                  </span>
                  <div className="tiny muted">{dateTime(n.at)}</div>
                </span>
                {!n.read && <span style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--brand)', flex: 'none', marginTop: 6 }} />}
              </button>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
