const Message = require('../models/Message');

// Get messages for a specific room
exports.getRoomMessages = async (req, res) => {
  try {
    const { room } = req.params;
    
    if (!room) {
      return res.status(400).json({ 
        success: false, 
        error: 'Room parameter is required' 
      });
    }
    
    // Get messages for the room, sorted by timestamp
    const messages = await Message.find({ 
      room,
      type: 'meeting'
    })
    .sort({ timestamp: 1 })
    .limit(100); // Limit to last 100 messages
    
    res.status(200).json({ 
      success: true, 
      messages 
    });
  } catch (error) {
    console.error('Error fetching room messages:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching messages' 
    });
  }
};

// Create a new message
exports.createMessage = async (req, res) => {
  try {
    const { content, room, sender, senderName } = req.body;
    
    if (!content || !room || !sender) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content, room, and sender are required' 
      });
    }
    
    const message = new Message({
      content,
      room,
      sender,
      senderName,
      type: 'meeting',
      timestamp: new Date()
    });
    
    await message.save();
    
    res.status(201).json({ 
      success: true, 
      message 
    });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error creating message' 
    });
  }
};
