// ================================
// Load saved UID when popup opens
// ================================
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("savedUID", (data) => {
    if (data.savedUID) {
      document.getElementById("uid").value = data.savedUID;
    }
  });
});

// ================================
// Submit button logic
// ================================
// ================================
// Submit button logic
// ================================
document.getElementById("submit").onclick = async () => {
  const userId = document.getElementById("uid").value.trim();
  const output = document.getElementById("output");

  // Validation
  if (userId === "") {
    output.innerText = "Error: Please enter your UID";
    return;
  }

  // Save UID permanently
  chrome.storage.local.set({ savedUID: userId });

  output.innerText = "Connecting...";

  try {
    const LOGIN_URL = "http://192.168.0.66:8090/";

    // 1. Fetch the login page
    // output.innerText = "Step 1: Fetching " + LOGIN_URL + "..."; // Removed debug
    const response = await fetch(LOGIN_URL);

    // output.innerText += "\nStatus: " + response.status; // Removed debug
    if (!response.ok) {
      throw new Error("Initial fetch failed: " + response.status);
    }

    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");

    // 2. Find form & Inputs
    let inputs = doc.querySelectorAll("input");
    // output.innerText += "\nInputs found: " + inputs.length; // Removed debug

    // Log input names for debugging
    const inputNames = Array.from(inputs).map(i => i.name || i.id).join(", ");
    console.log("Fields found:", inputNames); // Moved to console

    // Check for clues in text
    if (text.includes("Cyberoam") || text.includes("Sophos")) {
      console.log("Detected Cyberoam/Sophos portal");
    }

    if (inputs.length === 0) {
      throw new Error("No inputs found");
    }

    // 3. Prepare data
    const formData = new URLSearchParams();
    let foundUser = false;
    let foundPass = false;

    inputs.forEach(input => {
      const name = input.name;
      if (!name) return;

      const lowerName = name.toLowerCase();
      const lowerId = (input.id || "").toLowerCase();

      if (lowerId === "username" || lowerName.includes("user")) {
        formData.append(name, userId);
        foundUser = true;
      } else if (lowerId === "password" || input.type === "password" || lowerName.includes("pass")) {
        formData.append(name, userId);
        foundPass = true;
      } else {
        formData.append(name, input.value);
      }
    });

    // Cyberoam specific: often needs mode=191
    if (text.includes("Cyberoam") || text.includes("Sophos")) {
      if (!formData.has("mode")) formData.append("mode", "191");
    }

    if (!foundUser || !foundPass) {
      if (!foundUser) formData.append("username", userId);
      if (!foundPass) formData.append("password", userId);
      console.log("Forced standard fields");
    }

    // 4. Submit - Probe multiple endpoints
    // 4. Submit - Direct to confirmed endpoint
    const postUrl = "http://192.168.0.66:8090/login.xml";
    console.log("POST to " + postUrl);

    const loginResponse = await fetch(postUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData
    });

    if (loginResponse.ok) {
      const resultText = await loginResponse.text();

      // Cyberoam/Sophos XML response checking
      // Typical success: <status>LIVE</status> or <message>You have successfully logged in</message>
      console.log("Response:", resultText);

      if (resultText.includes("successfully") || resultText.includes("LIVE")) {
        output.innerText = "Connected successfully!";
      } else if (resultText.toLowerCase().includes("limit reached")) {
        output.innerText = "Login Failed: Data limit reached.";
      } else if (resultText.toLowerCase().includes("failed") || resultText.includes("Invalid")) {
        output.innerText = "Login Failed: Check ID/Password.";
      } else {
        // Ambiguous
        output.innerText = "Command Sent (Check access).";
      }
    } else {
      output.innerText = "Server Error: " + loginResponse.status;
    }

  } catch (err) {
    console.error(err);
    output.innerText = "Error: " + err.message;
  }
};
//  github version 