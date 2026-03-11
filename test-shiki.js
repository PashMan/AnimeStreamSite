async function run() {
  const res = await fetch('https://shikimori.one/api/animes?limit=5&rating=!rx');
  const data = await res.json();
  console.log(data.map(a => a.name));
}
run();
