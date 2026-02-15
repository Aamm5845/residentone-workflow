/**
 * StudioFlow Gmail Add-on — Create tasks from emails
 *
 * Entry point: onGmailMessageOpen(e)
 * Triggered when a user opens an email in Gmail with this add-on installed.
 */

// =============================================
// Entry point
// =============================================

function onGmailMessageOpen(e) {
  var apiKey = getApiKey();

  // If no API key is configured, show setup card
  if (!apiKey) {
    return buildSetupCard();
  }

  // Extract email metadata from the event
  var messageId = e.gmail.messageId;
  var accessToken = e.gmail.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);

  var message = GmailApp.getMessageById(messageId);
  var thread = message.getThread();

  var emailSubject = message.getSubject() || '(no subject)';
  var emailFrom = message.getFrom() || '';
  var emailBody = '';
  try {
    var plainBody = message.getPlainBody();
    if (plainBody) {
      emailBody = plainBody.substring(0, 1500);
    }
  } catch (err) {
    Logger.log('Could not read email body: ' + err);
  }
  var threadId = thread.getId();

  // Build Gmail URL
  var emailLink = 'https://mail.google.com/mail/u/0/#inbox/' + threadId;

  return buildCreateTaskCard(emailSubject, emailFrom, emailBody, emailLink);
}

// =============================================
// Setup card (first-time API key configuration)
// =============================================

function buildSetupCard() {
  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('StudioFlow Setup')
      .setSubtitle('Connect your StudioFlow account')
  );

  var section = CardService.newCardSection();
  section.addWidget(
    CardService.newTextParagraph().setText(
      'To create tasks from Gmail, you need to enter your StudioFlow Extension API key.\n\n' +
      'You can find your API key in StudioFlow under:\n' +
      '<b>Settings > Extension API Key > Generate</b>'
    )
  );

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('apiKey')
      .setTitle('Extension API Key')
      .setHint('Paste your ext_... key here')
  );

  section.addWidget(
    CardService.newTextButton()
      .setText('Save & Connect')
      .setOnClickAction(
        CardService.newAction().setFunctionName('saveApiKey')
      )
  );

  card.addSection(section);
  return [card.build()];
}

/**
 * Validate and save the API key
 */
function saveApiKey(e) {
  var key = e.formInput.apiKey;

  if (!key || key.trim().length === 0) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('Please enter an API key')
      )
      .build();
  }

  key = key.trim();

  // Validate the key by calling the extension auth endpoint
  try {
    var response = UrlFetchApp.fetch(API_BASE_URL + '/api/extension/auth', {
      method: 'get',
      headers: { 'X-Extension-Key': key },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(
            'Invalid API key. Please check and try again.'
          )
        )
        .build();
    }
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          'Could not connect to StudioFlow. Check the API URL.'
        )
      )
      .build();
  }

  // Save the key
  setApiKey(key);

  // Show success + refresh
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText('Connected to StudioFlow!')
    )
    .setNavigation(
      CardService.newNavigation().updateCard(buildSetupSuccessCard())
    )
    .build();
}

function buildSetupSuccessCard() {
  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('Connected!')
      .setSubtitle('StudioFlow is ready to use')
  );

  var section = CardService.newCardSection();
  section.addWidget(
    CardService.newTextParagraph().setText(
      'Your API key has been saved. Open any email to see the task creation form.\n\n' +
      'Reload this email to get started.'
    )
  );

  section.addWidget(
    CardService.newTextButton()
      .setText('Disconnect')
      .setOnClickAction(
        CardService.newAction().setFunctionName('handleDisconnect')
      )
  );

  card.addSection(section);
  return card.build();
}

function handleDisconnect() {
  clearApiKey();
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText('Disconnected from StudioFlow')
    )
    .setNavigation(
      CardService.newNavigation().updateCard(buildSetupCard()[0])
    )
    .build();
}

// =============================================
// Create Task card
// =============================================

function buildCreateTaskCard(emailSubject, emailFrom, emailBody, emailLink) {
  var apiKey = getApiKey();

  // Fetch projects, members, and AI-generated task in parallel-ish (sequential in Apps Script)
  var projects = [];
  var members = [];

  try {
    var projRes = UrlFetchApp.fetch(API_BASE_URL + '/api/extension/projects', {
      method: 'get',
      headers: { 'X-Extension-Key': apiKey },
      muteHttpExceptions: true,
    });
    if (projRes.getResponseCode() === 200) {
      var projData = JSON.parse(projRes.getContentText());
      projects = projData.projects || [];
    }
  } catch (err) {
    Logger.log('Error fetching projects: ' + err);
  }

  try {
    var memRes = UrlFetchApp.fetch(API_BASE_URL + '/api/extension/members', {
      method: 'get',
      headers: { 'X-Extension-Key': apiKey },
      muteHttpExceptions: true,
    });
    if (memRes.getResponseCode() === 200) {
      var memData = JSON.parse(memRes.getContentText());
      members = memData.members || [];
    }
  } catch (err) {
    Logger.log('Error fetching members: ' + err);
  }

  // Use AI to generate a clean task title and description from the email
  var taskTitle = emailSubject;
  var taskDescription = emailBody ? emailBody.substring(0, 200) : '';
  var aiGenerated = false;

  try {
    var aiPayload = {
      emailSubject: emailSubject,
      emailFrom: emailFrom,
      emailBody: emailBody
    };

    var aiRes = UrlFetchApp.fetch(API_BASE_URL + '/api/extension/tasks/ai-extract', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Extension-Key': apiKey },
      payload: JSON.stringify(aiPayload),
      muteHttpExceptions: true,
    });

    if (aiRes.getResponseCode() === 200) {
      var aiData = JSON.parse(aiRes.getContentText());
      if (aiData.ok && aiData.title) {
        taskTitle = aiData.title;
        taskDescription = aiData.description || '';
        aiGenerated = aiData.aiGenerated || false;
      }
    }
  } catch (err) {
    Logger.log('AI extract failed (using raw email data): ' + err);
  }

  // Build the card
  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('Create StudioFlow Task')
      .setSubtitle('From: ' + emailFrom)
  );

  var section = CardService.newCardSection();

  // Show AI badge if AI-generated
  if (aiGenerated) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        '<i>✨ AI-generated from email — edit as needed</i>'
      )
    );
  }

  // Title (pre-filled with AI-generated or raw subject)
  section.addWidget(
    CardService.newTextInput()
      .setFieldName('title')
      .setTitle('Task Title')
      .setValue(taskTitle)
  );

  // Description (pre-filled with AI-generated or raw snippet)
  section.addWidget(
    CardService.newTextInput()
      .setFieldName('description')
      .setTitle('Description')
      .setValue(taskDescription)
      .setMultiline(true)
  );

  // Project dropdown
  if (projects.length > 0) {
    var projectDropdown = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('projectId')
      .setTitle('Project');

    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      var label = p.name + (p.clientName ? ' (' + p.clientName + ')' : '');
      projectDropdown.addItem(label, p.id, i === 0);
    }
    section.addWidget(projectDropdown);
  }

  // Assignee dropdown
  if (members.length > 0) {
    var memberDropdown = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('assignedToId')
      .setTitle('Assign To');

    for (var j = 0; j < members.length; j++) {
      var m = members[j];
      var memberLabel = (m.name || m.email) + (m.name ? ' (' + m.email + ')' : '');
      memberDropdown.addItem(memberLabel, m.id, false);
    }
    section.addWidget(memberDropdown);
  }

  // Priority dropdown
  var priorityDropdown = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('priority')
    .setTitle('Priority')
    .addItem('Urgent', 'URGENT', false)
    .addItem('High', 'HIGH', false)
    .addItem('Medium', 'MEDIUM', true)
    .addItem('Low', 'LOW', false);
  section.addWidget(priorityDropdown);

  // Due date picker
  section.addWidget(
    CardService.newDatePicker()
      .setFieldName('dueDate')
      .setTitle('Due Date')
  );

  // Submit button — email metadata passed as action parameters (hidden from user)
  var createAction = CardService.newAction()
    .setFunctionName('createTask')
    .setParameters({
      emailLink: emailLink || '',
      emailSubject: emailSubject || '',
      emailFrom: emailFrom || ''
    });

  section.addWidget(
    CardService.newTextButton()
      .setText('Create Task')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(createAction)
  );

  // Disconnect link
  section.addWidget(
    CardService.newTextButton()
      .setText('Disconnect Account')
      .setOnClickAction(
        CardService.newAction().setFunctionName('handleDisconnect')
      )
  );

  card.addSection(section);
  return [card.build()];
}

// =============================================
// Create the task
// =============================================

function createTask(e) {
  var apiKey = getApiKey();
  var formInput = e.formInput || {};
  var params = e.parameters || {};

  var title = formInput.title;
  var description = formInput.description;
  var projectId = formInput.projectId;
  var assignedToId = formInput.assignedToId;
  var priority = formInput.priority || 'MEDIUM';

  // Due date from date picker (comes as {msSinceEpoch: number} object)
  var dueDate = null;
  var dueDateInput = e.formInputs && e.formInputs.dueDate;
  if (dueDateInput && dueDateInput.msSinceEpoch) {
    dueDate = new Date(parseInt(dueDateInput.msSinceEpoch)).toISOString();
  } else if (formInput.dueDate) {
    // Fallback: try formInput directly
    try {
      dueDate = new Date(parseInt(formInput.dueDate)).toISOString();
    } catch (err) {
      Logger.log('Could not parse due date: ' + err);
    }
  }

  // Email metadata comes from action parameters (hidden from user)
  var emailLink = params.emailLink || '';
  var emailSubject = params.emailSubject || '';
  var emailFrom = params.emailFrom || '';

  if (!title || title.trim().length === 0) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('Task title is required')
      )
      .build();
  }

  if (!projectId) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('Please select a project')
      )
      .build();
  }

  if (!assignedToId) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('Please select an assignee')
      )
      .build();
  }

  try {
    var payload = {
      title: title.trim(),
      description: description ? description.trim() : undefined,
      projectId: projectId,
      assignedToId: assignedToId,
      priority: priority,
      dueDate: dueDate || undefined,
      emailLink: emailLink || undefined,
      emailSubject: emailSubject || undefined,
      emailFrom: emailFrom || undefined,
    };

    var response = UrlFetchApp.fetch(API_BASE_URL + '/api/extension/tasks', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Extension-Key': apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    var code = response.getResponseCode();
    var body = JSON.parse(response.getContentText());

    if (code === 201 && body.ok) {
      return CardService.newActionResponseBuilder()
        .setNavigation(
          CardService.newNavigation().updateCard(
            buildSuccessCard(body.task)
          )
        )
        .build();
    } else {
      var errMsg = body.error || 'Failed to create task (HTTP ' + code + ')';
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(errMsg)
        )
        .build();
    }
  } catch (err) {
    Logger.log('Error creating task: ' + err);
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('Network error: ' + err.message)
      )
      .build();
  }
}

// =============================================
// Success card
// =============================================

function buildSuccessCard(task) {
  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('Task Created!')
      .setSubtitle(task.project ? task.project.name : '')
  );

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextParagraph().setText(
      '<b>' + task.title + '</b>\n\n' +
      'Assigned to: ' + (task.assignedTo ? (task.assignedTo.name || task.assignedTo.email) : 'Unassigned') + '\n' +
      'Priority: ' + task.priority
    )
  );

  // Link to view task in StudioFlow
  var taskUrl = API_BASE_URL + '/tasks/' + task.id;
  section.addWidget(
    CardService.newTextButton()
      .setText('View in StudioFlow')
      .setOpenLink(
        CardService.newOpenLink()
          .setUrl(taskUrl)
          .setOpenAs(CardService.OpenAs.FULL_SIZE)
      )
  );

  // Create another task button
  section.addWidget(
    CardService.newTextButton()
      .setText('Create Another Task')
      .setOnClickAction(
        CardService.newAction().setFunctionName('onGmailMessageOpen')
      )
  );

  card.addSection(section);
  return card.build();
}
