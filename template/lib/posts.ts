// La fábrica sobrescribe este archivo con artículos SEO escritos por el agente de crecimiento.
// Formato del contenido: párrafos separados por una línea en blanco; "## " para subtítulos; "- " para listas.
export type Post = { slug: string; title: string; description: string; date: string; content: string };

export const posts: Post[] = [];
