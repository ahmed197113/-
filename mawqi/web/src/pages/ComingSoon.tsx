import { useParams } from 'react-router-dom'
import { NAV } from '../nav'
import { Icon } from '../icons'

export default function ComingSoon() {
  const { section } = useParams()
  const item = NAV.find((n) => n.path === `/${section}`)
  return (
    <div className="empty">
      <Icon name={item?.icon ?? 'dashboard'} size={56} />
      <h2>{item?.label ?? 'غير موجود'}</h2>
      <p>هذا القسم قيد التطوير وسيُضاف في المرحلة القادمة.</p>
    </div>
  )
}
