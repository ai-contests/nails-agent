const run = async () => {
  try {
    console.log("=== Testing Main Page (/en) ===");
    const resHome = await fetch('http://localhost:3000/en');
    const htmlHome = await resHome.text();
    console.log("Main Page OK?", resHome.status === 200);
    // Is trending styles hardcoded? 
    // We check if "STYLE001" or similar is in the HTML
    console.log("Contains STYLE001?", htmlHome.includes('STYLE001'));
    
    console.log("\n=== Testing Gallery Page (/en/gallery) ===");
    const resGallery = await fetch('http://localhost:3000/en/gallery');
    const htmlGallery = await resGallery.text();
    console.log("Gallery Page OK?", resGallery.status === 200);
    console.log("Includes 'Page not found'?", htmlGallery.includes('Page not found') || htmlGallery.includes('could not be found'));
    
    console.log("\n=== Testing API /api/recommendations/main ===");
    const resApi = await fetch('http://localhost:3000/api/recommendations/main');
    const dataApi = await resApi.json();
    console.log("API returned snapshotId:", !!dataApi.snapshotId);
    console.log("API items count:", dataApi.items ? dataApi.items.length : 0);
    
    console.log("\n=== Testing B-End Admin Page (/en/admin) ===");
    const resAdmin = await fetch('http://localhost:3000/en/admin');
    const htmlAdmin = await resAdmin.text();
    console.log("Admin Page OK?", resAdmin.status === 200);
    console.log("Contains pending_reviews?", htmlAdmin.includes('pending_reviews') || htmlAdmin.includes('Pending Reviews'));
    console.log("Contains chart/echarts/canvas?", htmlAdmin.includes('canvas') || htmlAdmin.includes('chart'));
    
    console.log("\n=== Testing API /api/admin/pending-reviews ===");
    const resReviews = await fetch('http://localhost:3000/api/admin/pending-reviews');
    console.log("Pending Reviews API status:", resReviews.status);

  } catch (e) {
    console.error(e);
  }
};
run();
