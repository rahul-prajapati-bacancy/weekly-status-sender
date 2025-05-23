// Initialize global variables
let quill;
let statusMessageTimeout;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme
  initializeTheme();
  
  // Display current date
  displayCurrentDate();
  
  // Initialize Quill editor
  initQuillEditor();
  
  // Initialize event listeners
  initEventListeners();
  
  // Check if we need to initialize default webhooks
  initializeDefaultWebhookIfNeeded();
});

function displayCurrentDate() {
  const dateElement = document.getElementById('currentDate');
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = new Date().toLocaleDateString('en-US', options);
  dateElement.textContent = formattedDate;
}

function initQuillEditor() {
  // Configure Quill with custom formats and modules
  const toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['clean']
  ];
  
  quill = new Quill('#editor-container', {
    modules: {
      toolbar: toolbarOptions
    },
    placeholder: 'Compose your weekly status update...',
    theme: 'snow'
  });
  
  // Apply theme-specific styles to Quill editor
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  if (currentTheme === 'dark') {
    const editorContainer = document.querySelector('.ql-editor');
    if (editorContainer) {
      editorContainer.style.color = 'var(--text-primary)';
      editorContainer.style.backgroundColor = 'var(--card-bg)';
    }
  }
  
  // Add CSS to adjust Quill toolbar for themes
  const style = document.createElement('style');
  style.textContent = `
    [data-theme="dark"] .ql-toolbar {
      background-color: var(--card-bg);
      border-color: var(--border);
    }
    [data-theme="dark"] .ql-container {
      border-color: var(--border);
    }
    [data-theme="dark"] .ql-editor {
      color: var(--text-primary);
      background-color: var(--card-bg);
    }
    [data-theme="dark"] .ql-toolbar button svg {
      filter: invert(0.8);
    }
  `;
  document.head.appendChild(style);
  
  // Implement auto-formatting for bullet points
  quill.on('text-change', function(delta, oldDelta, source) {
    if (source !== 'user') return;
    
    const text = quill.getText();
    const position = quill.getSelection()?.index;
    
    if (position && text[position-2] === '-' && text[position-1] === ' ') {
      // Delete the '- ' characters
      quill.deleteText(position-2, 2);
      // Insert a bullet point
      quill.formatLine(position-2, 1, 'list', 'bullet');
    }
    
    if (position && text[position-2] === '*' && text[position-1] === ' ') {
      // Delete the '* ' characters
      quill.deleteText(position-2, 2);
      // Insert a bullet point
      quill.formatLine(position-2, 1, 'list', 'bullet');
    }
  });
}

function initEventListeners() {
  // Clear editor button
  document.getElementById('clearEditor').addEventListener('click', () => {
    quill.setText('');
  });
  
  // Save as template button
  document.getElementById('saveTemplate').addEventListener('click', () => {
    openModal('templateModal');
  });
  
  // Template modal events
  document.getElementById('cancelTemplate').addEventListener('click', () => {
    closeModal('templateModal');
  });
  
  document.getElementById('saveTemplateBtn').addEventListener('click', saveTemplate);
  
  // Close modal buttons
  const closeButtons = document.querySelectorAll('.close-modal');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modalId = button.closest('.modal').id;
      closeModal(modalId);
    });
  });
  
  // Templates menu item - open template list
  document.getElementById('templatesMenuItem').addEventListener('click', () => {
    loadTemplatesList();
    openModal('templateListModal');
  });
  
  document.getElementById('closeTemplateList').addEventListener('click', () => {
    closeModal('templateListModal');
  });
  
  // Webhooks menu item - open webhooks management
  document.getElementById('webhooksMenuItem').addEventListener('click', () => {
    loadWebhooksList();
    openModal('webhooksModal');
  });
  
  document.getElementById('closeWebhooksList').addEventListener('click', () => {
    closeModal('webhooksModal');
  });
  
  // Theme toggle
  document.querySelector('.theme-toggle').addEventListener('click', toggleTheme);
  
  // Help & Support
  document.getElementById('helpBtn').addEventListener('click', () => {
    openModal('helpModal');
  });
  
  document.getElementById('closeHelp').addEventListener('click', () => {
    closeModal('helpModal');
  });
  
  // Add webhook button
  document.getElementById('addWebhookBtn').addEventListener('click', addWebhook);
  
  // Cancel send button in recipient modal
  document.getElementById('cancelSend').addEventListener('click', () => {
    closeModal('recipientModal');
  });
  
  // Modify send button to open recipient selection first
  document.getElementById('sendButton').addEventListener('click', () => {
    if (quill.getText().trim() === '') {
      showStatusMessage('Please enter a status update.', 'error');
      return;
    }
    
    loadRecipientsList();
    openModal('recipientModal');
  });
}

// Empty space - original sendStatus function removed as it's replaced by the sendToRecipient function

function showStatusMessage(message, type) {
  const statusEl = document.getElementById('responseStatus');
  
  // Clear any existing timeout
  if (statusMessageTimeout) {
    clearTimeout(statusMessageTimeout);
  }
  
  // Remove the show class first to reset any existing animation
  statusEl.classList.remove('show');
  
  // Use requestAnimationFrame to ensure the transition works
  requestAnimationFrame(() => {
    // Reset classes after a tiny delay to ensure transition works
    setTimeout(() => {
      // Reset classes
      statusEl.className = 'status-message';
      
      // Add the message and appropriate class
      statusEl.textContent = message;
      statusEl.classList.add(type);
      
      // Force a reflow to ensure the transition works
      void statusEl.offsetWidth;
      
      // Add the show class to trigger animation
      statusEl.classList.add('show');
    }, 10);
  });
  
  // Set timeout to hide the message
  statusMessageTimeout = setTimeout(() => {
    statusEl.classList.remove('show');
  }, 5000);
}

// Convert Quill content to Markdown for Google Chat
function convertQuillToMarkdown() {
  const delta = quill.getContents();
  let markdown = '';
  let inList = false;
  let listType = null;
  let bulletCounter = 0;
  
  delta.ops.forEach(op => {
    // Handle text content
    if (op.insert && typeof op.insert === 'string') {
      let text = op.insert;
      
      // Apply formatting based on attributes
      if (op.attributes) {
        if (op.attributes.bold) {
          text = `*${text}*`;
        }
        if (op.attributes.italic) {
          text = `_${text}_`;
        }
        if (op.attributes.strike) {
          text = `~${text}~`;
        }
        if (op.attributes.underline) {
          text = `_${text}_`; // Google Chat doesn't have underline in markdown, use italics
        }
      }
      
      // Handle different types of content based on block attributes
      if (op.attributes && op.attributes.list) {
        if (!inList || listType !== op.attributes.list) {
          inList = true;
          listType = op.attributes.list;
          bulletCounter = 0;
        }
        
        bulletCounter++;
        
        if (listType === 'bullet') {
          markdown += `• ${text}`;
        } else if (listType === 'ordered') {
          markdown += `${bulletCounter}. ${text}`;
        }
      } else {
        if (inList) {
          inList = false;
          listType = null;
          bulletCounter = 0;
        }
        
        markdown += text;
      }
    } 
    // Handle line breaks
    if (op.insert === '\n') {
      markdown += '\n';
    }
  });
  
  return markdown;
}

// Template Management Functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  
  // Reset any previous animation classes and make sure it's visible
  modal.style.display = 'block';
  modal.classList.remove('hide');
  
  // Show the modal with animation
  modal.classList.add('show');
  
  if (modalId === 'templateModal') {
    setTimeout(() => {
      document.getElementById('templateName').focus();
    }, 500);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  
  // Add hide animation class
  modal.classList.add('hide');
  modal.classList.remove('show');
  
  // Actually hide the modal after animation completes
  setTimeout(() => {
    modal.classList.remove('hide');
    modal.style.display = 'none';
    
    // Reset fields if needed
    if (modalId === 'templateModal') {
      document.getElementById('templateName').value = '';
    }
  }, 500);
}

function saveTemplate() {
  const templateName = document.getElementById('templateName').value.trim();
  
  if (!templateName) {
    showStatusMessage('Please enter a template name', 'error');
    return;
  }
  
  if (quill.getText().trim() === '') {
    showStatusMessage('Cannot save an empty template', 'error');
    return;
  }
  
  // Get current templates from localStorage
  const templates = getTemplates();
  
  // Save the new template
  templates.push({
    id: Date.now(),
    name: templateName,
    content: quill.getContents(),
    created: new Date().toISOString()
  });
  
  // Save back to localStorage
  localStorage.setItem('weeklyStatusTemplates', JSON.stringify(templates));
  
  // Close the modal and show confirmation
  closeModal('templateModal');
  showStatusMessage('Template saved successfully!', 'success');
}

function getTemplates() {
  const templatesJson = localStorage.getItem('weeklyStatusTemplates');
  return templatesJson ? JSON.parse(templatesJson) : [];
}

function loadTemplatesList() {
  const templatesContainer = document.getElementById('templatesList');
  templatesContainer.innerHTML = '';
  
  const templates = getTemplates();
  
  if (templates.length === 0) {
    templatesContainer.innerHTML = '<div class="no-templates">No saved templates yet.</div>';
    return;
  }
  
  templates.forEach(template => {
    const templateItem = document.createElement('div');
    templateItem.className = 'template-item';
    
    templateItem.innerHTML = `
      <div class="template-name">${template.name}</div>
      <div class="template-actions">
        <button class="load-template" data-id="${template.id}" title="Load template">📝</button>
        <button class="delete-template" data-id="${template.id}" title="Delete template">🗑️</button>
      </div>
    `;
    
    templatesContainer.appendChild(templateItem);
  });
  
  // Add event listeners for template actions
  document.querySelectorAll('.load-template').forEach(button => {
    button.addEventListener('click', (e) => {
      const templateId = parseInt(e.target.getAttribute('data-id'));
      loadTemplate(templateId);
    });
  });
  
  document.querySelectorAll('.delete-template').forEach(button => {
    button.addEventListener('click', (e) => {
      const templateId = parseInt(e.target.getAttribute('data-id'));
      deleteTemplate(templateId);
    });
  });
}

function loadTemplate(templateId) {
  const templates = getTemplates();
  const template = templates.find(t => t.id === templateId);
  
  if (template) {
    quill.setContents(template.content);
    closeModal('templateListModal');
    showStatusMessage(`Template "${template.name}" loaded`, 'success');
  }
}

function deleteTemplate(templateId) {
  const templates = getTemplates();
  const updatedTemplates = templates.filter(t => t.id !== templateId);
  
  localStorage.setItem('weeklyStatusTemplates', JSON.stringify(updatedTemplates));
  loadTemplatesList();
  showStatusMessage('Template deleted', 'success');
}

// Theme Management Functions
function initializeTheme() {
  const savedTheme = localStorage.getItem('weeklyStatusTheme') || 'light';
  setTheme(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('weeklyStatusTheme', theme);
  
  const themeIcon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');
  
  if (theme === 'dark') {
    themeIcon.textContent = '☀️';
    themeText.textContent = 'Light Mode';
  } else {
    themeIcon.textContent = '🌙';
    themeText.textContent = 'Dark Mode';
  }
  
  // Also update Quill editor theme
  if (quill) {
    const editorContainer = document.querySelector('.ql-editor');
    if (editorContainer) {
      if (theme === 'dark') {
        editorContainer.style.color = 'var(--text-primary)';
        editorContainer.style.backgroundColor = 'var(--card-bg)';
      } else {
        editorContainer.style.color = '';
        editorContainer.style.backgroundColor = '';
      }
    }
  }
}

// Webhook Management Functions
function getWebhooks() {
  const webhooksJson = localStorage.getItem('weeklyStatusWebhooks');
  return webhooksJson ? JSON.parse(webhooksJson) : [];
}

function initializeDefaultWebhookIfNeeded() {
  const webhooks = getWebhooks();
  
  if (webhooks.length === 0) {
    // Add a default Google Chat webhook for backward compatibility
    // This adds the now-removed hardcoded URL as the first webhook entry
    webhooks.push({
      id: Date.now(),
      name: "My Chat",
      url: "https://chat.googleapis.com/v1/spaces/AAAA1lFjDjs/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=_SRAluT_BiU3KgZUcbnAIoP6k1MZ_VCrd__NAAgKPN0",
      created: new Date().toISOString()
    });
    
    localStorage.setItem('weeklyStatusWebhooks', JSON.stringify(webhooks));
  }
}

function addWebhook() {
  const webhookName = document.getElementById('webhookName').value.trim();
  const webhookURL = document.getElementById('webhookURL').value.trim();
  
  if (!webhookName) {
    showStatusMessage('Please enter a recipient name', 'error');
    return;
  }
  
  if (!webhookURL) {
    showStatusMessage('Please enter a webhook URL', 'error');
    return;
  }
  
  try {
    new URL(webhookURL); // Validate URL format
  } catch (e) {
    showStatusMessage('Please enter a valid URL', 'error');
    return;
  }
  
  // Get current webhooks from localStorage
  const webhooks = getWebhooks();
  
  // Save the new webhook
  webhooks.push({
    id: Date.now(),
    name: webhookName,
    url: webhookURL,
    created: new Date().toISOString()
  });
  
  // Save back to localStorage
  localStorage.setItem('weeklyStatusWebhooks', JSON.stringify(webhooks));
  
  // Clear form fields
  document.getElementById('webhookName').value = '';
  document.getElementById('webhookURL').value = '';
  
  // Refresh the webhooks list
  loadWebhooksList();
  
  // Show confirmation
  showStatusMessage('Webhook added successfully!', 'success');
}

function loadWebhooksList() {
  const webhooksContainer = document.getElementById('webhooksList');
  webhooksContainer.innerHTML = '';
  
  const webhooks = getWebhooks();
  
  if (webhooks.length === 0) {
    webhooksContainer.innerHTML = '<div class="no-webhooks">No webhooks configured yet. Add one above.</div>';
    return;
  }
  
  webhooks.forEach(webhook => {
    const webhookItem = document.createElement('div');
    webhookItem.className = 'webhook-item';
    
    webhookItem.innerHTML = `
      <div class="webhook-info">
        <div class="webhook-name">${webhook.name}</div>
        <div class="webhook-url">${webhook.url}</div>
      </div>
      <div class="webhook-actions">
        <button class="edit-webhook" data-id="${webhook.id}" title="Edit webhook">✏️</button>
        <button class="delete-webhook" data-id="${webhook.id}" title="Delete webhook">🗑️</button>
      </div>
    `;
    
    webhooksContainer.appendChild(webhookItem);
  });
  
  // Add event listeners for webhook actions
  document.querySelectorAll('.delete-webhook').forEach(button => {
    button.addEventListener('click', (e) => {
      const webhookId = parseInt(e.target.getAttribute('data-id'));
      deleteWebhook(webhookId);
    });
  });
  
  document.querySelectorAll('.edit-webhook').forEach(button => {
    button.addEventListener('click', (e) => {
      const webhookId = parseInt(e.target.getAttribute('data-id'));
      editWebhook(webhookId);
    });
  });
}

function deleteWebhook(webhookId) {
  const webhooks = getWebhooks();
  const updatedWebhooks = webhooks.filter(w => w.id !== webhookId);
  
  localStorage.setItem('weeklyStatusWebhooks', JSON.stringify(updatedWebhooks));
  loadWebhooksList();
  showStatusMessage('Webhook deleted', 'success');
}

function editWebhook(webhookId) {
  const webhooks = getWebhooks();
  const webhook = webhooks.find(w => w.id === webhookId);
  
  if (webhook) {
    // Fill form with webhook data
    document.getElementById('webhookName').value = webhook.name;
    document.getElementById('webhookURL').value = webhook.url;
    
    // Delete the old webhook
    deleteWebhook(webhookId);
    
    // Focus on the name field
    document.getElementById('webhookName').focus();
  }
}

function loadRecipientsList() {
  const recipientsContainer = document.getElementById('recipientsList');
  recipientsContainer.innerHTML = '';
  
  const webhooks = getWebhooks();
  
  if (webhooks.length === 0) {
    recipientsContainer.innerHTML = `
      <div class="no-webhooks">
        <p>No recipients configured yet.</p>
        <button id="configureWebhooksBtn" class="action-button">Configure Webhooks</button>
      </div>
    `;
    
    document.getElementById('configureWebhooksBtn').addEventListener('click', () => {
      closeModal('recipientModal');
      loadWebhooksList();
      openModal('webhooksModal');
    });
    
    return;
  }
  
  webhooks.forEach(webhook => {
    const recipientOption = document.createElement('div');
    recipientOption.className = 'recipient-option';
    recipientOption.setAttribute('data-id', webhook.id);
    
    recipientOption.innerHTML = `
      <div class="recipient-info">
        <div class="recipient-name">${webhook.name}</div>
      </div>
    `;
    
    recipientOption.addEventListener('click', () => {
      sendToRecipient(webhook.id);
    });
    
    recipientsContainer.appendChild(recipientOption);
  });
}

function sendToRecipient(webhookId) {
  closeModal('recipientModal');
  
  const webhooks = getWebhooks();
  const webhook = webhooks.find(w => w.id === parseInt(webhookId));
  
  if (!webhook) {
    showStatusMessage('Selected recipient not found.', 'error');
    return;
  }
  
  // Convert rich text to markdown for Google Chat formatting
  const markdownText = convertQuillToMarkdown();
  
  // Animate send button
  const sendButton = document.getElementById('sendButton');
  sendButton.innerHTML = '<span class="send-icon">⏳</span><span>Sending...</span>';
  sendButton.disabled = true;
  
  const payload = JSON.stringify({
    text: markdownText
  });

  fetch(webhook.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: payload
  })
    .then(response => {
      if (response.ok) {
        showStatusMessage(`Status update sent successfully to ${webhook.name}!`, 'success');
        quill.setText('');
      } else {
        return response.text().then(text => { throw new Error(text); });
      }
    })
    .catch(error => {
      showStatusMessage(`Failed to send: ${error.message}`, 'error');
    })
    .finally(() => {
      // Reset send button
      sendButton.innerHTML = '<span class="send-icon">📤</span><span>Send Update</span>';
      sendButton.disabled = false;
    });
}
