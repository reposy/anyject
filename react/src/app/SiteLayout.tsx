import { Link, Outlet } from 'react-router'
import { SITE_NAME } from './site.ts'
import './layout.css'

export function SiteLayout() {
  return (
    <div className="site">
      <header className="site-header">
        <Link to="/" className="site-name">
          {SITE_NAME}
        </Link>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">© {SITE_NAME}</footer>
    </div>
  )
}
