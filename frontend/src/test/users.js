// Test fixture shaped like GET /users (same in the monolith and user-service).
const NAMES = [
  'Thiago', 'Maria', 'João', 'Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Fábio', 'Gabriela',
  'Hugo', 'Isabela', 'Júlia', 'Lucas', 'Marcos', 'Natália', 'Otávio', 'Paula', 'Rafael', 'Sofia',
  'Thiago Souza', 'Úrsula', 'Vitor', 'Wagner', 'Yara',
]

export function makeUsers(count = 25) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: NAMES[i % NAMES.length],
    // Not in ID order, so sorting by date is observably different from by ID.
    created_at: new Date(Date.UTC(2025, 0, 1 + ((i * 7) % count), 12)).toISOString(),
  }))
}
