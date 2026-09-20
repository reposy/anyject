export function EmbedHead({ slug }: { slug: string }) {
  return (
    <>
      <meta name="robots" content="noindex" />
      <link rel="canonical" href={`${window.location.origin}/${slug}`} />
    </>
  )
}
