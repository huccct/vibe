export function pickToy(toys, previousSlug) {
  const playable = toys.filter((toy) => !toy.disabled && !toy.hidden)
  const others = playable.filter((toy) => toy.slug !== previousSlug)
  const choices = others.length ? others : playable
  return choices[Math.floor(Math.random() * choices.length)]
}
