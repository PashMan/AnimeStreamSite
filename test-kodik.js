async function run() {
  const res = await fetch('https://kodikapi.com/search?token=b3b563060d02ee000ca18740b7842ca0&shikimori_id=16498,1535');
  const data = await res.json();
  console.log(data);
}
run();
