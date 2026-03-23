/* =========================
   SOP Auto-Link Definitions
   ========================= */

const SOP_LINKS = [
  {
    terms: ["Me", "Mario Peñalver", "Mr. P"],
    url: "https://drive.google.com/open?id=1g53pPu0Wrv_gr1FJbRP3h2uZrkMlqn-J&usp=drive_fs"
  },
  {
    terms: [
      "DM",
      "Division Manager",
      "Division Leadership",
      "Division Leader",
      "Leadership Team",
      "Leadership Position"
    ],
    url: "https://docs.google.com/spreadsheets/d/1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I/edit?gid=931965198#gid=931965198"
  },
  {
    terms: ["Manager Control Center"],
    url: "#control-center" // internal menu link
  },
  {
    terms: ["Trip-o-Meter", "Trip‑o‑Meter"],
    url: "https://docs.google.com/presentation/d/1yb2DFhj_sG1zRsjYjGH703A1xwIKPcmGsR7cl0Zm2Wk/present?slide=id.p1"
  },
  {
    terms: ["Weather Reports"],
    url: "https://docs.google.com/spreadsheets/d/1px1NzRmcf0sSRp0u3SZE4dKlYXbfagyHdRYNYGeNJM8/edit?gid=362165540#gid=362165540"
  },
  {
    terms: ["POW"],
    url: "https://docs.google.com/forms/d/e/1FAIpQLScsUtR2Gg-dq8xUl-7urF65T4ffiTefeGQlevGGyW8gNOjBXg/viewform"
  },
  {
    terms: ["Google Calendar", "Google Calendars"],
    url: "https://calendar.google.com"
  },
  {
    terms: ["Canva"],
    url: "https://www.canva.com/login"
  },
  {
    terms: ["Pixlr", "Adobe Express"],
    url: "https://www.adobe.com/express/"
  },
  {
    terms: ["SOAR Matrix", "SOAR matrix"],
    url: "https://docs.google.com/presentation/d/1vnfwGOwpY2NwgvZCNghgx_5ueHsjzFYecfasCU0wnxM/edit?slide=id.p1#slide=id.p1"
  },
  {
    terms: ["NEST™ Print Form"],
    url: "https://docs.google.com/forms/d/e/1FAIpQLScGtcbvGnwnloQKpd15pelduyp5ohsT6aQx6qF13DBcZ4RKgg/viewform"
  },
  {
    terms: ["Printer Queue"],
    url: "https://docs.google.com/spreadsheets/d/13Dnk31EDgx2_E46gkEAJ_e0gamqsA_VoFSf8qQEr4vk/edit?gid=47407658#gid=47407658"
  }
];

function escapeForRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function autoLinkContent(html) {
  let output = html;

  SOP_LINKS.forEach(({ terms, url }) => {
    terms.forEach(term => {
      const escapedTerm = escapeForRegex(term);

      // Match whole words / phrases only (no substrings)
      const pattern = new RegExp(
        `(^|[^A-Za-z])(${escapedTerm})(?=[^A-Za-z]|$)`,
        "g"
      );

      output = output.replace(
        pattern,
        `$1<a href="${url}" target="_blank">$2</a>`
      );
    });
  });

  return output;
}

/* =========================
   Live Date
   ========================= */

const dateEl = document.getElementById("today-date");

if (dateEl) {
  const options = {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  };

  const today = new Date();
  dateEl.textContent = `Today is ${today.toLocaleDateString("en-US", options)}`;
}

/* =========================
   SOPs Interactivity
   ========================= */

const sopsButtons = document.querySelectorAll(".sops-link");
const sopsTitle = document.querySelector(".sops-content h1");
const sopsSubtitle = document.querySelector(".sops-content .subtitle");
const sopsPlaceholder = document.querySelector(".sops-content .placeholder");

const sopsData = {
  "Community Agreements": {
    title: "",
    subtitle: "",
    content: `
      <div class="ca-landing">
        <div class="ca-row">
            <div class="ca-item" onmouseover="showCA('curious')" onmouseout="hideCA()">
                <img src="assets/curiouscentricity.png" alt="Curiouscentricity">
            </div>
            <div class="ca-item" onmouseover="showCA('shared')" onmouseout="hideCA()">
                <img src="assets/shared_understanding.png" alt="Shared Understanding">
            </div>
            <div class="ca-item" onmouseover="showCA('allin')" onmouseout="hideCA()">
                <img src="assets/all_in_all_heard.png" alt="All in, All heard">
            </div>
        </div>
        <div class="ca-row">
            <div class="ca-item" onmouseover="showCA('teamship')" onmouseout="hideCA()">
                <img src="assets/teamship.png" alt="Teamship">
            </div>
            <div class="ca-title-wrapper">
                <img src="assets/ca_title.png" alt="NEST Community Agreements">
            </div>
            <div class="ca-item" onmouseover="showCA('objective')" onmouseout="hideCA()">
                <img src="assets/objective_leadership.png" alt="Objective Leadership">
            </div>
        </div>
        <div class="ca-row">
            <div class="ca-item" onmouseover="showCA('accountability')" onmouseout="hideCA()">
                <img src="assets/accountability.png" alt="Accountability">
            </div>
            <div class="ca-item" onmouseover="showCA('living')" onmouseout="hideCA()">
                <img src="assets/living_document.png" alt="Living Document">
            </div>
        </div>
        <div class="ca-display-box">
            <p id="ca-text-display">
                <strong style="color: var(--primary-orange); font-size: 1.2rem;">NEST™ Motto:</strong><br><em style="font-size: 1.2rem;">Never leave an Eagle behind.</em><br><br><span style="font-size: 1.2rem; color: var(--text-muted);">Hover over a core value above to see its description.</span>
            </p>
        </div>
      </div>
    `
  },

  "Division Norms": {
    title: "Division Norms",
    subtitle: "What professionalism looks like day to day",
    content: `
      <ul>
        <li>Be a service-centered leader to others.</li>
        <li>Lean into your resources: Canvas, StudentVue, your leadership team, me.</li>
        <li>When entering the room, grab your laptop, log in, and go to our Canvas course to find the current project/assignment.</li>
      </ul>
      <p><strong>Our Attention Getter:</strong></p>
      <ul>
        <li>If you hear my voice, clap once.</li>
        <li>If you hear my voice, clap twice.</li>
        <li>If you hear my voice, clap three times.</li>
      </ul>
      <ul>
        <li>Please communicate with your Safety Officer when leaving the room. Unless cleared, only 1 person outside the room at a time.</li>
        <li><strong>10/10:</strong> Unless previously arranged with your DM, no passes during the first and last 10 minutes.</li>
      </ul>
      <br>
      <p><em>"If you want to go fast, go alone; if you want to go far, go together." — African Proverb</em></p>
    `
  },

  "Manager Norms": {
    title: "Manager Norms",
    subtitle: "Expectations for leaders and managers",
    content: `
      <p><strong>Be organized:</strong></p>
      <ul>
        <li>using the Manager Control Center.</li>
        <li>Keeping meetings on division Google Calendars.</li>
        <li>Fill out POWs up to date, for every meeting, and any official business.</li>
        <li>Measure progress of the division using the Trip-o-Meter.</li>
      </ul>
      <ul>
        <li>Make sure all partners are safe and feel cared for by all, using your Weather Reports as evidence.</li>
        <li>Keep partners on a task, with help from your Assistant Manager.</li>
        <li>Once a week, connect with the entire division using the Division Meeting Slideshow.</li>
        <li>Manager work stays at "The Office".</li>
      </ul>
      <br>
      <p style="font-size: 0.85rem; color: var(--text-muted);">
        <em>*Created by Grant Harris - Division Manager • Lily Hopper - Assistant Manager • Karis Lidstrom - Managing Consultant • Colby Piquet - Chief Operations (Winter, 2023)</em>
      </p>
    `
  },

  "First 5 / Last 5": {
    title: "First 5 / Last 5",
    subtitle: "How we start strong and finish responsibly",
    content: `
      <h3>First 5 Expectations</h3>
      <ul>
        <li>You are in your assigned seat.</li>
        <li>Your station computer is logged in.</li>
        <li>Google Drive is open and running.</li>
        <li>You’ve opened the NEST™ Menu.</li>
      </ul>

      <h3>Last 5 Expectations</h3>
      <ul>
        <li>Return equipment to proper locations.</li>
        <li>Log out of all programs.</li>
        <li>Clean your workspace.</li>
        <li>Prepare the space for the next group.</li>
      </ul>
    `
  },

  "Team Roles": {
    title: "Team Roles",
    subtitle: "Clear roles lead to effective collaboration",
    content: `
      <ul>
        <li><strong>Project Manager:</strong> Leads discussion, keeps team on task and on time.</li>
        <li><strong>Secretary:</strong> Records ideas, notes, and decisions.</li>
        <li><strong>Engineer:</strong> Builds, designs, and iterates solutions.</li>
        <li><strong>Presenter / Emcee:</strong> Communicates ideas to others.</li>
      </ul>
    `
  },

  "Rules of Engagement": {
    title: "Rules of Engagement",
    subtitle: "How we work together respectfully and productively",
    content: `
      <ul>
        <li>Stay with your group.</li>
        <li>Two ears, one mouth — listen more than you talk.</li>
        <li>All for one, and one for all.</li>
        <li>Each person contributes equally.</li>
        <li>Check the board for instructions and updates.</li>
      </ul>
    `
  },

  "Magic Spinner": {
    title: "Magic Spinner",
    subtitle: "Fair, transparent random name selection",
    content: `
      <p><strong>Transparency is everything.</strong></p>

      <p>
        Trip‑o‑Meter (legacy tool):
        <a href="https://docs.google.com/presentation/d/1yb2DFhj_sG1zRsjYjGH703A1xwIKPcmGsR7cl0Zm2Wk/present?slide=id.p1"
          target="_blank">
          Open Trip‑o‑Meter
        </a>
      </p>

      <div style="display: flex; gap: 32px; align-items: flex-start;">

        <!-- LEFT: Controls -->
        <div style="flex: 1;">
          <label>
            Paste student names (one per line):
            <textarea
              id="spinner-names"
              rows="8"
              style="width: 100%; margin-top: 8px;"
              placeholder="Alex Johnson\nMaria Lopez\nJordan Kim\nSam Patel"
            ></textarea>
          </label>

          <div style="margin: 16px 0;">
            <button id="spin-button" style="
              padding: 10px 16px;
              background: #E87722;
              color: black;
              border: none;
              border-radius: 8px;
              font-size: 1rem;
              cursor: pointer;
              margin-right: 8px;
            ">
              SPIN
            </button>

            <button id="reset-spinner" style="
              padding: 10px 16px;
              background: #333;
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 1rem;
              cursor: pointer;
            ">
              RESET
            </button>

            <div id="spinner-status" style="
              font-size: 0.9rem;
              opacity: 0.8;
              margin-top: 8px;
            ">
              Paste names to begin.
            </div>
          </div>

          <div id="spinner-result" style="
            font-size: 2.5rem;
            font-weight: bold;
            color: #E87722;
            margin-top: 24px;
            min-height: 3.5rem;
          ">
            —
          </div>
        </div>

        <!-- RIGHT: Selected Names -->
        <div style="width: 220px;">
          <h3>Selected</h3>
          <ul id="selected-list" style="
            list-style: none;
            padding: 0;
            margin: 0;
            max-height: 300px;
            overflow-y: auto;
          ">
          </ul>
        </div>

      </div>
    `
  },

  "Break Protocol": {
    title: "Break Protocol",
    subtitle: "Responsible use of time outside the room",
    content: `
      <ul>
        <li>You may take bathroom breaks as needed.</li>
        <li>Be gone no longer than 15 minutes.</li>
        <li>Go directly to the bathroom and return.</li>
        <li>Abuse of this privilege results in temporary loss.</li>
      </ul>
    `
  },

  "Presentation Norms": {
    title: "Presentation Norms",
    subtitle: "Expectations when sharing work",
    content: `
      <ul>
        <li><strong>Engineer:</strong> Operates visual aids.</li>
        <li><strong>Emcee:</strong> Introduces team and manages Q&A.</li>
        <li><strong>Presenter:</strong> Walks the audience through the work.</li>
      </ul>
    `
  },

  "Peer Editing": {
    title: "Peer Editing",
    subtitle: "How we give helpful feedback",
    content: `
      <ul>
        <li>Something that went well.</li>
        <li>Something else that went well.</li>
        <li>Something that could be improved.</li>
        <li>Keep feedback constructive and respectful.</li>
      </ul>
    `
  },

  "File Naming": {
    title: "File Naming",
    subtitle: "So no work is ever lost or overwritten",
    content: `
      <p>
        Proper file naming prevents accidental overwrites and makes shared
        folders usable for everyone.
      </p>

      <p>
        <strong>Required format:</strong><br />
        <code>Period_LastName_ProjectName_V#.ext</code>
      </p>

      <p>
        Example:<br />
        <code>3_Penalver_RobotArm_V2.stl</code>
      </p>

      <img
        src="assets/sops_filenaming.gif"
        alt="File naming demonstration"
        style="
          max-width: 100%;
          border-radius: 12px;
          margin: 24px 0;
          border: 1px solid #333;
        "
      />
    `
  },

  "Team Workbooks": {
    title: "Team Workbooks",
    subtitle: "How teams organize shared work",
    content: `
      <ul>
        <li>Identify a Project Manager.</li>
        <li>Create a shared Google Drive folder.</li>
        <li>Share with all team members and leadership.</li>
        <li>Keep documents organized and clearly named.</li>
      </ul>
    `
  },

  "3D Printing": {
    title: "3D Printing",
    subtitle: "Authorization, submission, and tracking",
    content: `
      <ul>
        <li>All prints must be approved by the Division 3D Print Specialist.</li>
        <li>Submit files using the NEST™ Print Form.</li>
        <li>Monitor progress using the Printer Queue.</li>
        <li>Retrieve prints promptly when complete.</li>
      </ul>
    `
  },

  "Corrections": {
    title: "Corrections",
    subtitle: "Steps taken when expectations are not met",
    content: `
      <ol>
        <li>SOAR conversation with Division Manager.</li>
        <li>Email home.</li>
        <li>Administrative conversation.</li>
        <li>After‑school detention.</li>
      </ol>
      <p>
        All corrections are documented to support growth and accountability.
      </p>
    `
  },

  "Mission Statement": {
    title: "Mission Statement",
    subtitle: "Why NEST™ exists",
    content: `
      <p>
        NEST™ cultivates service‑centered leaders and prepares all students
        for post‑secondary education or direct entry into the workforce —
        equipped to succeed without ongoing support.
      </p>
    `
  }
};

/* =========================
   Click behavior
   ========================= */

if (sopsButtons.length > 0) {
    sopsButtons.forEach(button => {
      button.addEventListener("click", () => {
        const label = button.textContent.trim();

        if (!sopsData[label]) return;

        sopsButtons.forEach(b => b.classList.remove("active"));
        button.classList.add("active");

        if(sopsTitle) {
          sopsTitle.textContent = sopsData[label].title;
          sopsTitle.style.display = sopsData[label].title ? "block" : "none";
        }
        if(sopsSubtitle) {
          sopsSubtitle.textContent = sopsData[label].subtitle;
          sopsSubtitle.style.display = sopsData[label].subtitle ? "block" : "none";
        }
        if(sopsPlaceholder) sopsPlaceholder.innerHTML = autoLinkContent(sopsData[label].content);
      });
    });
    
    // Auto-load the default active tab (Community Agreements) on page load
    const defaultTab = document.querySelector(".sops-link.active");
    if (defaultTab) {
        defaultTab.click();
    }
}

/* =========================
   Magic Spinner Logic (Names, No Repeats, Polished)
   ========================= */

let remainingNames = [];
let spinning = false;

document.addEventListener("click", (event) => {
  if (event.target.id !== "spin-button" && event.target.id !== "reset-spinner") {
    return;
  }

  const namesInput = document.getElementById("spinner-names");
  const resultEl = document.getElementById("spinner-result");
  const listEl = document.getElementById("selected-list");
  const statusEl = document.getElementById("spinner-status");

  if (!namesInput || !resultEl || !listEl || !statusEl) return;

  // RESET
  if (event.target.id === "reset-spinner") {
    remainingNames = [];
    spinning = false;
    resultEl.textContent = "—";
    listEl.innerHTML = "";
    statusEl.textContent = "Paste names to begin.";
    return;
  }

  if (spinning) return;

  // Initialize names on first spin
  if (remainingNames.length === 0) {
    remainingNames = namesInput.value
      .split("\n")
      .map(name => name.trim())
      .filter(Boolean);

    if (remainingNames.length === 0) {
      statusEl.textContent = "Please paste at least one name.";
      return;
    }
  }

  spinning = true;
  statusEl.textContent = "Spinning…";

  const finalIndex = Math.floor(Math.random() * remainingNames.length);
  const finalName = remainingNames[finalIndex];

  let spins = 15;
  const interval = setInterval(() => {
    const tempIndex = Math.floor(Math.random() * remainingNames.length);
    resultEl.textContent = remainingNames[tempIndex];
    spins--;

    if (spins <= 0) {
      clearInterval(interval);

      remainingNames.splice(finalIndex, 1);
      resultEl.textContent = finalName;

      const li = document.createElement("li");
      li.textContent = finalName;
      listEl.appendChild(li);

      spinning = false;
      statusEl.textContent =
        remainingNames.length === 0
          ? "All names have been selected."
          : `${remainingNames.length} remaining`;
    }
  }, 80);
});

// Set dynamic copyright year
const yearEl = document.getElementById("current-year");
if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
}

/* =========================
   Community Agreements Hover Logic
   ========================= */
const caDescriptions = {
    curious: "<strong>curiousCENTRICITY.</strong> None of us is an expert — and that's a good thing. We approach every challenge with curiosity and a mindset for learning, reframing 'Why?' as an invitation, not a shutdown.",
    shared: "<strong>Shared Understanding.</strong> We work together to ensure everyone understands how our team operates — so we can all grow, contribute, and help each other succeed. We actively create and share resources to build on what we know and support others in doing the same.",
    allin: "<strong>ALL in, ALL heard.</strong> Everyone's voice matters. Make space to speak, and make space to listen. We iterate, we don't tear down. Team norms are decided on by the team and not unilaterally.",
    teamship: "<strong>TEAMship.</strong> We own our actions — and their impact — together. If something goes wrong, we focus on solutions, not blame.",
    objective: "<strong>Objective Leadership.</strong> Leadership is built on trust, fairness, and integrity. To uphold these values, our leaders avoid conflicts of interest — including romantic relationships with fellow leaders that could impact team confidence or decision-making. Relationships are encouraged, but not at the cost of the group's success and productivity.",
    accountability: "<strong>accountABILITY.</strong> Accountability to one's own position and to the group. If there is a concern brought by a member of the group, we have a shared role in resolving the issue.",
    living: "<strong>Living Document.</strong> We believe that we change. And because we change, so do our beliefs. Accordingly, we believe that these community agreements need to evolve with us."
};

const defaultCAText = `<strong style="color: var(--primary-orange); font-size: 1.2rem;">NEST™ Motto:</strong><br><em style="font-size: 1.2rem;">Never leave an Eagle behind.</em><br><br><span style="font-size: 1.2rem; color: var(--text-muted);">Hover over a core value above to see its description.</span>`;

window.showCA = function(key) {
    const display = document.getElementById('ca-text-display');
    if(display && caDescriptions[key]) {
        display.innerHTML = caDescriptions[key];
    }
};

window.hideCA = function() {
    const display = document.getElementById('ca-text-display');
    if(display) {
        display.innerHTML = defaultCAText;
    }
};

/* =========================
   SOAR Matrix Hover Logic
   ========================= */
const soarData = {
    'S': `
        <h2 style="color: var(--primary-orange); font-size: 2rem; margin-bottom: 20px; text-align: center;">SAFETY</h2>
        <table class="soar-table">
            <tr>
                <th>Entering Classroom</th>
                <td>Walk. Keep hands to yourself. Leave Lab materials alone until directed by the Dir. of Inventory. Place personal items under lab station.</td>
            </tr>
            <tr>
                <th>Instruction Time</th>
                <td>Walk to center of room for class meetings. Keep all chair feet on the floor.</td>
            </tr>
            <tr>
                <th>Study Support</th>
                <td>Stay seated unless you have a purpose. When leaving, sign out using SmartPass, then select the teacher/location you are going to as your location. A confirmation email from the destination teacher is required prior to leaving.</td>
            </tr>
            <tr>
                <th>Working Time</th>
                <td>Always use SmartPass when signing out. Be where you signed out to be. Have a project-based reason to be where you are. Use equipment as instructed by your Inventory Director.</td>
            </tr>
            <tr>
                <th>Electronics</th>
                <td>Phones, iPads and other personal devices are away. In emergencies, phones can be used by the entrance to the Lab. Lab Station (mouse, monitor, keyboard) and other equipment are handled with care. Visit school-appropriate websites.</td>
            </tr>
            <tr>
                <th>Leaving Classroom</th>
                <td>Remain at seat until dismissed. Walk when leaving. Clean your Lab Station.</td>
            </tr>
        </table>
    `,
    'O': `
        <h2 style="color: var(--primary-orange); font-size: 2rem; margin-bottom: 20px; text-align: center;">OWNERSHIP</h2>
        <table class="soar-table">
            <tr>
                <th>Entering Classroom</th>
                <td>Being professional = Thinking professionally & Dressing Professionally. Bring supplies: your assigned laptop, and a pen to write with.</td>
            </tr>
            <tr>
                <th>Instruction Time</th>
                <td>Remember S.L.A.N.T. Sit up. Lean forward. Ask & Answer questions. Nod at or Note the details. Track the speaker.</td>
            </tr>
            <tr>
                <th>Study Support</th>
                <td>Being productive for any class. Phones remain away during study support.</td>
            </tr>
            <tr>
                <th>Working Time</th>
                <td>Be an example to others. Be original and authentic. Know your responsibilities in group work. Know your Leadership Team and who to refer to for help.</td>
            </tr>
            <tr>
                <th>Electronics</th>
                <td>Phones, iPads and other personal devices are away. Lab Station (mouse, laptop, keyboard) and other equipment are handled with care. Visit project-related and school-appropriate websites.</td>
            </tr>
            <tr>
                <th>Leaving Classroom</th>
                <td>Remember Last 5: Plug in laptop to assigned cart location. Place mouse and keyboard back in drawer, and SD cards back in assigned book slot. STAY at station until the music changes.</td>
            </tr>
        </table>
    `,
    'A': `
        <h2 style="color: var(--primary-orange); font-size: 2rem; margin-bottom: 20px; text-align: center;">ATTEND</h2>
        <table class="soar-table">
            <tr>
                <th>Entering Classroom</th>
                <td>Arrive on time. Log in to your assigned laptop, open the NEST™ Menu, and open Canvas to preview and/or complete projects for the course.</td>
            </tr>
            <tr>
                <th>Instruction Time</th>
                <td>Remember S.L.A.N.T. Sit up. Lean forward. Ask & Answer questions. Nod at or Note the details. Track the speaker. For Labs, move to the center of the room and face the Promethean Board.</td>
            </tr>
            <tr>
                <th>Study Support</th>
                <td>During study support students are working independently or collaboratively, Mr P is available for help if needed. When you're done you can talk with neighbors.</td>
            </tr>
            <tr>
                <th>Working Time</th>
                <td>Listen to and validate others during collaboration. Contribute to classroom discussions. Use your resources: Elbow partners, Student Experts, Division Leaders, Canvas and the NEST™ Menu.</td>
            </tr>
            <tr>
                <th>Electronics</th>
                <td>Phones, iPads and other personal devices are away. Lab Station (mouse, monitor, keyboard) and other equipment are handled with care. Visit project-related and school-appropriate websites.</td>
            </tr>
            <tr>
                <th>Leaving Classroom</th>
                <td>Listen for last minute instructions or reminders.</td>
            </tr>
        </table>
    `,
    'R': `
        <h2 style="color: var(--primary-orange); font-size: 2rem; margin-bottom: 20px; text-align: center;">RESPECT</h2>
        <table class="soar-table">
            <tr>
                <th>Entering Classroom</th>
                <td><a class="db-link" onclick="openDbMeter(event)">dB: 90</a>. Come and dress, ready to participate. Use working voices. Help yourself and others find success.</td>
            </tr>
            <tr>
                <th>Instruction Time</th>
                <td><a class="db-link" onclick="openDbMeter(event)">dB: 70</a>. Monitors off. Remember S.L.A.N.T. Sit up. Lean forward. Ask & Answer questions. Nod at or Note the details. Track the speaker.</td>
            </tr>
            <tr>
                <th>Study Support</th>
                <td><a class="db-link" onclick="openDbMeter(event)">dB: 80</a>. If talking be aware of who's around you and respond to their needs. Raise your hand if you need a student expert to help you.</td>
            </tr>
            <tr>
                <th>Working Time</th>
                <td>Be a student expert to someone who needs help. Say or do something that makes someone else feel appreciated.</td>
            </tr>
            <tr>
                <th>Electronics</th>
                <td>Use Headphones. Get permission BEFORE downloading software.</td>
            </tr>
            <tr>
                <th>Leaving Classroom</th>
                <td><a class="db-link" onclick="openDbMeter(event)">dB: 90</a>. Clean your Lab Station. Leave the room cleaner than you found it.</td>
            </tr>
        </table>
    `
};

const defaultSOARText = `
    <div style="text-align: center; padding: 60px 20px;">
        <h2 style="color: var(--primary-orange); font-size: 2.5rem; margin-bottom: 16px;">SOAR Matrix</h2>
        <p style="color: var(--text-muted); font-size: 1.2rem;">Hover over a letter above to view the classroom expectations.</p>
    </div>
`;

window.showSOAR = function(key) {
    const display = document.getElementById('soar-text-display');
    if(display && soarData[key]) {
        display.innerHTML = soarData[key];
        
        // Update active state on letters
        document.querySelectorAll('.soar-letter').forEach(el => el.classList.remove('active'));
        const activeBtn = document.getElementById('soar-btn-' + key);
        if(activeBtn) activeBtn.classList.add('active');
    }
};

// We remove hideSOAR entirely so the content stays visible when the mouse moves away
window.hideSOAR = function() {
    // Intentionally left blank to preserve the last hovered table
};

/* =========================
   Decibel Meter Modal Logic
   ========================= */
window.openDbMeter = function(e) {
    if(e) e.preventDefault();
    const modal = document.getElementById('db-modal');
    const iframe = document.getElementById('db-iframe');
    if(modal && iframe) {
        // Only set src if it's empty to avoid reloading unnecessarily, 
        // or set it every time if you want a fresh instance.
        // Force reload the iframe to ensure it renders when the modal opens
        iframe.src = "https://sounddecibelmeter.com/";
        modal.classList.add('active');
    }
};

window.closeDbMeter = function(e) {
    // If event is passed, ensure we are clicking the background or close button
    if(e && e.target.id !== 'db-modal' && !e.target.classList.contains('modal-close')) {
        return;
    }
    const modal = document.getElementById('db-modal');
    if(modal) {
        modal.classList.remove('active');
    }
};


/* =========================
   Live Bell Schedule Fetch Logic
   ========================= */

// Robust CSV Parser
function parseCSV(str) {
    const arr = [];
    let quote = false;
    for (let row = 0, col = 0, c = 0; c < str.length; c++) {
        let cc = str[c], nc = str[c+1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';
        if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
        if (cc == '"') { quote = !quote; continue; }
        if (cc == ',' && !quote) { ++col; continue; }
        if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
        if (cc == '\n' && !quote) { ++row; col = 0; continue; }
        if (cc == '\r' && !quote) { ++row; col = 0; continue; }
        arr[row][col] += cc;
    }
    return arr;
}



// Mobile Dropdown Logic
document.addEventListener('DOMContentLoaded', () => {
    // Header dropdowns
    const headerBtns = document.querySelectorAll('.dropdown-btn');
    headerBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Close all other dropdowns first
            closeAllDropdowns();
            const content = btn.nextElementSibling;
            if (content) content.classList.toggle('show');
        });
    });

    // Footer dropdowns
    const footerBtns = document.querySelectorAll('.footer-dropdown-title');
    footerBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Close all other dropdowns first
            closeAllDropdowns();
            const content = btn.nextElementSibling;
            if (content) content.classList.toggle('show');
        });
    });

    // Close dropdowns when clicking anywhere else on the screen
    window.addEventListener('click', (e) => {
        if (!e.target.matches('.dropdown-btn') && !e.target.matches('.footer-dropdown-title')) {
            closeAllDropdowns();
        }
    });

    function closeAllDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown-content, .footer-dropdown-content');
        dropdowns.forEach(d => {
            if (d.classList.contains('show')) {
                d.classList.remove('show');
            }
        });
    }
});

// ================================
// MOBILE: Tap-to-open card dropdowns
// ================================
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const dashboard = document.querySelector('.dashboard');
    if (!dashboard) return;

    const cards = Array.from(dashboard.querySelectorAll('.card'));
    if (!cards.length) return;

    // Only activate on touch-like devices
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isTouch) return;

    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        // If user clicked a link inside an open dropdown, let it navigate
        if (e.target && e.target.closest('a')) return;

        // toggle this card, close others
        const willOpen = !card.classList.contains('open');
        cards.forEach(c => c.classList.remove('open'));
        if (willOpen) card.classList.add('open');
      });
    });

    // Tap outside to close
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest('.card')) return;
      cards.forEach(c => c.classList.remove('open'));
    });
  });
})();
