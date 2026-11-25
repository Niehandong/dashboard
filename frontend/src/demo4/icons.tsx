// demo4 用到的图标，全部内联 SVG，颜色照原图
type Name = 'folder' | 'mapPin' | 'growth' | 'person'
  | 'bars' | 'cube' | 'nodes' | 'target' | 'doc' | 'hand' | 'order' | 'trophy'

const P = '#6B3FD9' // 05 栏 KPI 图标紫

export function Icon({ name, color = '#fff' }: { name: Name; color?: string }) {
  switch (name) {
    // ---------- 标题栏右侧的半透明大图标 ----------
    case 'folder':
      return (
        <svg viewBox="0 0 90 72" width="90" height="72" aria-hidden>
          <defs><linearGradient id="d4f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity=".25" /></linearGradient></defs>
          <path d="M22 4h26l6 7h30v54H22z" fill="url(#d4f)" stroke="#fff" strokeOpacity=".7" strokeWidth="1.5" />
          <path d="M12 14h26l6 7h30v48H12z" fill="#fff" fillOpacity=".35" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" />
          <path d="M4 28h72l-6 42H10z" fill="#fff" fillOpacity=".45" stroke="#fff" strokeOpacity=".9" strokeWidth="1.5" />
        </svg>
      )
    case 'mapPin':
      return (
        <svg viewBox="0 0 96 76" width="96" height="76" aria-hidden>
          <path d="M8 36l24-8 26 8 30-10v44L58 80 32 70 8 78z" fill="#fff" fillOpacity=".2" stroke="#fff" strokeOpacity=".75" strokeWidth="1.4" transform="translate(0 -6)" />
          <path d="M32 22v50M58 30v50M20 50l60-12M14 62l70-14" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" />
          <path d="M62 2c-9.4 0-17 7.4-17 16.6C45 31 62 46 62 46s17-15 17-27.4C79 9.4 71.4 2 62 2z" fill="#fff" fillOpacity=".55" stroke="#fff" strokeWidth="1.5" />
          <circle cx="62" cy="18" r="6" fill="#F28A3C" fillOpacity=".55" />
        </svg>
      )
    case 'growth':
      return (
        <svg viewBox="0 0 96 76" width="96" height="76" aria-hidden>
          <rect x="18" y="52" width="13" height="20" rx="1.5" fill="#fff" fillOpacity=".45" />
          <rect x="40" y="40" width="13" height="32" rx="1.5" fill="#fff" fillOpacity=".55" />
          <rect x="62" y="30" width="13" height="42" rx="1.5" fill="#fff" fillOpacity=".65" />
          <path d="M8 48l22-18 16 10 34-30" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M70 6h14v14" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    // ---------- 正文图标 ----------
    case 'person':
      return (
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
          <circle cx="16" cy="10" r="6.5" fill="#fff" />
          <path d="M3 30c0-7.2 5.8-12 13-12s13 4.8 13 12z" fill="#fff" />
        </svg>
      )
    case 'bars':
      return (
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
          <rect x="4" y="16" width="6" height="14" rx="1" fill={P} /><rect x="13" y="4" width="6" height="26" rx="1" fill={P} /><rect x="22" y="11" width="6" height="19" rx="1" fill={P} />
        </svg>
      )
    case 'cube':
      return (
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
          <path d="M12 2l8 3v8l-8 3-8-3V5z" fill="#8A6CF0" /><path d="M4 5l8 3 8-3" stroke="#C9BAFA" strokeWidth="1.2" fill="none" />
          <path d="M3 14l9 3.5V31L3 27.5z" fill="#5A35C9" /><path d="M12 17.5l9-3.5 9 3.5V31l-9 0-9 0z" fill={P} />
          <path d="M3 14l9-3.5 9 3.5-9 3.5z" fill="#9F86F2" /><path d="M21 14l9 3.5" stroke="#9F86F2" strokeWidth="1.5" />
          <path d="M17 21l3 3-3 3" stroke="#E7DEFF" strokeWidth="1.4" fill="none" />
        </svg>
      )
    case 'nodes':
      return (
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
          <path d="M16 6L5 25h22z" stroke={P} strokeWidth="2.4" fill="none" strokeLinejoin="round" />
          {[[16, 6], [5, 25], [27, 25]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4" fill="#fff" stroke={P} strokeWidth="2.6" />)}
        </svg>
      )
    case 'target':
      return (
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
          <circle cx="15" cy="17" r="13" fill="none" stroke={P} strokeWidth="2.6" />
          <circle cx="15" cy="17" r="8.4" fill="none" stroke={P} strokeWidth="2.6" />
          <circle cx="15" cy="17" r="3.6" fill={P} />
          <path d="M15 17L28 4M24 3.5l4.5.5.5 4.5" stroke={P} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </svg>
      )
    // ---------- 季度卡片底部的小图标 ----------
    case 'doc':
      return <svg viewBox="0 0 20 22" width="18" height="20" aria-hidden><rect x="1" y="1" width="16" height="20" rx="2.5" fill={color} /><path d="M5 7h8M5 11h8M5 15h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
    case 'hand':
      return <svg viewBox="0 0 22 22" width="20" height="20" aria-hidden><rect x="1" y="1" width="20" height="20" rx="4" fill={color} /><path d="M11 4v9M7.5 9.5L11 13l3.5-3.5M5 14v3h12v-3" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'order':
      return <svg viewBox="0 0 22 22" width="20" height="20" aria-hidden><rect x="1" y="1" width="20" height="20" rx="3" fill={color} /><rect x="5" y="5" width="12" height="13" rx="1.5" fill="none" stroke="#fff" strokeWidth="1.6" /><path d="M8 11l2 2 4-4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
    case 'trophy':
      return <svg viewBox="0 0 22 22" width="20" height="20" aria-hidden><rect x="3" y="1" width="16" height="20" rx="3" fill={color} /><path d="M7 6h8v3a4 4 0 0 1-8 0zM11 13v3M8 17h6" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
  }
}


// 「客户基本信息」右侧的总部大楼图：蓝天 + 玻璃幕墙写字楼 + 绿化
export function BuildingPhoto() {
  const cols = 9, rows = 11
  return (
    <svg viewBox="0 0 136 132" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label="客户总部大楼">
      <defs>
        <linearGradient id="d4sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6FA3DC" /><stop offset=".55" stopColor="#B9D5F0" /><stop offset="1" stopColor="#E6F0FA" /></linearGradient>
        <linearGradient id="d4front" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7FA9D6" /><stop offset=".5" stopColor="#3E6FA8" /><stop offset="1" stopColor="#24497A" /></linearGradient>
        <linearGradient id="d4side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2C5689" /><stop offset="1" stopColor="#1C3A63" /></linearGradient>
        <linearGradient id="d4low" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5D8CC0" /><stop offset="1" stopColor="#2B5283" /></linearGradient>
      </defs>
      <rect width="136" height="132" fill="url(#d4sky)" />
      <ellipse cx="28" cy="18" rx="22" ry="6" fill="#fff" opacity=".55" /><ellipse cx="108" cy="12" rx="18" ry="4" fill="#fff" opacity=".45" />
      {/* 后面的矮楼 */}
      <path d="M2 72l26-4v46H2z" fill="url(#d4low)" />
      {Array.from({ length: 6 }, (_, r) => <path key={r} d={`M2 ${78 + r * 6}l26-1`} stroke="#9CC0E6" strokeOpacity=".5" strokeWidth=".6" />)}
      {/* 主楼：正面 + 侧面 */}
      <path d="M40 30l70-18v104H40z" fill="url(#d4front)" />
      <path d="M110 12l24 10v94h-24z" fill="url(#d4side)" />
      {Array.from({ length: cols + 1 }, (_, c) => { const x = 40 + c * 70 / cols; const y0 = 30 - c * 18 / cols; return <path key={'v' + c} d={`M${x} ${y0}V116`} stroke="#C9DEF4" strokeOpacity=".55" strokeWidth=".7" /> })}
      {Array.from({ length: rows }, (_, r) => <path key={'h' + r} d={`M40 ${36 + r * 7.6}L110 ${18 + r * 8.9}`} stroke="#C9DEF4" strokeOpacity=".5" strokeWidth=".6" />)}
      {Array.from({ length: rows }, (_, r) => <path key={'s' + r} d={`M110 ${18 + r * 8.9}L134 ${28 + r * 8}`} stroke="#86A9D2" strokeOpacity=".4" strokeWidth=".6" />)}
      <path d="M44 34l30-7v40L44 80z" fill="#fff" opacity=".12" />
      {/* 地面与绿化 */}
      <rect y="112" width="136" height="20" fill="#C8D3DC" />
      <rect y="110" width="136" height="5" fill="#6FA35A" />
      {[6, 18, 32, 50, 64, 80, 96, 116, 128].map((x, i) => <ellipse key={x} cx={x} cy={108 - (i % 2) * 2} rx={5 + (i % 3)} ry={6 + (i % 2) * 2} fill={i % 2 ? '#4E8A42' : '#5F9B4E'} />)}
      <path d="M0 124h136" stroke="#E9EEF2" strokeWidth="2" />
    </svg>
  )
}
