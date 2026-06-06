const run = async () => {
  try {
    const resAdmin = await fetch('http://localhost:3000/en/admin');
    const textAdmin = await resAdmin.text();
    console.log(textAdmin.substring(0, 500));
    console.log('Includes Dashboard:', textAdmin.includes('Dashboard') || textAdmin.includes('Agent'));
    console.log('Includes 404 exactly?', textAdmin.includes('This page could not be found') || textAdmin.includes('404'));
  } catch (e) {
    console.error(e);
  }
};
run();
