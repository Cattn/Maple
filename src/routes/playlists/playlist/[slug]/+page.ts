export async function load({ params }) {
  return {
    playlistId: params.slug
  };
}
