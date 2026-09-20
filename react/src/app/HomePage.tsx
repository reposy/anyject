import { Link } from 'react-router'
import { toys } from '../toys/registry.ts'
import { SITE_NAME } from './site.ts'

export function HomePage() {
  return (
    <>
      <title>{SITE_NAME}</title>
      <h1>{SITE_NAME}</h1>
      <ul className="toy-list">
        {toys.map((toy) => (
          <li key={toy.slug}>
            <Link to={`/${toy.slug}`}>{toy.title}</Link>
            <p>{toy.description}</p>
          </li>
        ))}
      </ul>
    </>
  )
}
