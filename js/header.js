<div id="headerMount"></div>

<script>
fetch("header.html")
  .then(response => response.text())
  .then(html => {

    document.getElementById("headerMount").innerHTML = html;

    initJmbnHeader();

  })
  .catch(error => {
    console.error("Failed to load JMBN header:", error);
  });
</script>
