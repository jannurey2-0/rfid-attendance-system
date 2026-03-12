function showTeacherToken() {
  const token = localStorage.getItem("teacherAccessToken");

  if (!token) {
    console.log("❌ No teacher access token found.");
    return;
  }

  console.log("✅ Teacher Access Token:");
  console.log(token);
  console.log("Length:", token.length);
}