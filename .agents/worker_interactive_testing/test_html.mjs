const run = async () => {
  try {
    const resGallery = await fetch('http://localhost:3000/en/gallery');
    const htmlGallery = await resGallery.text();
    const titleMatch = htmlGallery.match(/<title[^>]*>(.*?)<\/title>/i);
    const h1Match = htmlGallery.match(/<h1[^>]*>(.*?)<\/h1>/i);
    console.log("Gallery Page Title:", titleMatch ? titleMatch[1] : null);
    console.log("Gallery Page H1:", h1Match ? h1Match[1] : null);
    
    const resAdmin = await fetch('http://localhost:3000/en/admin');
    const htmlAdmin = await resAdmin.text();
    const h1MatchAdmin = htmlAdmin.match(/<h1[^>]*>(.*?)<\/h1>/i);
    console.log("Admin Page H1:", h1MatchAdmin ? h1MatchAdmin[1] : null);
  } catch (e) {
    console.error(e);
  }
};
run();
