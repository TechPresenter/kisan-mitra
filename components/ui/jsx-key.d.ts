// The project has no @types/react, so TypeScript has no JSX.IntrinsicAttributes and rejects
// `key` on function components (`items.map(x => <ListRow key={x.id} …/>)`). This restores only
// that. Harmless once @types/react is installed (react-jsx then uses React's own JSX types);
// delete it at that point.
declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: string | number | null;
    }
  }
}

export {};
