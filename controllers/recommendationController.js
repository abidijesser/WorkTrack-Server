const User = require("../models/User");
const Project = require("../models/Project");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Initialize the Google Generative AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Get available Gemini model
 * @returns {Object} The available model
 */
const getAvailableModel = async () => {
  try {
    // Try Gemini 1.5 first, then fall back to Gemini Pro
    const modelOptions = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

    for (const modelName of modelOptions) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        // Test the model with a simple request
        await model.generateContent("Test");
        console.log(`Using model: ${modelName}`);
        return { success: true, model, modelName };
      } catch (error) {
        console.error(`Model ${modelName} failed:`, error.message);
      }
    }

    throw new Error("No available Gemini models found");
  } catch (error) {
    console.error("Error getting Gemini model:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Extract keywords from task title and description using Gemini
 * @param {string} title - Task title
 * @param {string} description - Task description
 * @returns {Array} Array of keywords
 */
const extractKeywords = async (title, description) => {
  try {
    const { success, model, error } = await getAvailableModel();

    if (!success) {
      console.error("Failed to get Gemini model:", error);
      // Fallback to simple keyword extraction
      return simpleKeywordExtraction(title, description);
    }

    const prompt = `
      Extract the most important skills or keywords from this task:
      Title: ${title}
      Description: ${description}

      Return only a JSON array of keywords, like this: ["keyword1", "keyword2", "keyword3"]
      Focus on technical skills, tools, and domain knowledge that would be required to complete this task.
      Return at least 3 and at most 10 keywords.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Extract JSON array from the response
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      try {
        const keywords = JSON.parse(jsonMatch[0]);
        return keywords;
      } catch (parseError) {
        console.error("Error parsing keywords JSON:", parseError);
      }
    }

    // Fallback to simple extraction if JSON parsing fails
    return simpleKeywordExtraction(title, description);
  } catch (error) {
    console.error("Error extracting keywords with Gemini:", error);
    return simpleKeywordExtraction(title, description);
  }
};

/**
 * Simple keyword extraction without AI
 * @param {string} title - Task title
 * @param {string} description - Task description
 * @returns {Array} Array of keywords
 */
const simpleKeywordExtraction = (title, description) => {
  // Combine title and description
  const text = `${title} ${description}`;

  // Remove common words and punctuation
  const commonWords = [
    "and",
    "the",
    "to",
    "a",
    "an",
    "in",
    "on",
    "for",
    "of",
    "with",
    "is",
    "are",
    "this",
    "that",
    "these",
    "those",
    "it",
    "they",
    "we",
    "you",
    "he",
    "she",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "can",
    "have",
    "has",
    "had",
    "been",
    "was",
    "were",
    "be",
    "being",
    "from",
    "by",
    "at",
    "as",
    "but",
    "or",
    "if",
    "then",
    "so",
    "than",
    "very",
    "just",
    "more",
    "most",
    "some",
    "any",
    "all",
    "not",
    "no",
  ];

  // Split text into words, convert to lowercase, and filter out common words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !commonWords.includes(word));

  // Count word frequency
  const wordCount = {};
  words.forEach((word) => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Sort by frequency and get top keywords
  const sortedWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0]);

  // Add domain-specific keywords that might be important for tech projects
  const techKeywords = [
    "développement",
    "development",
    "programming",
    "code",
    "software",
    "web",
    "api",
    "database",
    "frontend",
    "backend",
    "fullstack",
    "design",
    "testing",
    "debug",
    "fix",
    "implement",
    "feature",
    "ui",
    "ux",
    "interface",
    "mobile",
    "desktop",
    "app",
    "application",
    "server",
    "client",
    "network",
    "security",
    "data",
    "analytics",
    "cloud",
    "devops",
    "agile",
    "scrum",
    "sprint",
    "test",
    "javascript",
    "python",
    "java",
    "php",
    "html",
    "css",
    "react",
    "angular",
    "vue",
    "node",
    "express",
    "mongodb",
    "sql",
    "mysql",
    "postgresql",
    "nosql",
    "git",
    "github",
    "gitlab",
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
  ];

  // Extract tech keywords from the text
  const extractedTechKeywords = techKeywords.filter((keyword) =>
    text.toLowerCase().includes(keyword)
  );

  // Combine and deduplicate keywords
  const combinedKeywords = [
    ...new Set([...sortedWords, ...extractedTechKeywords]),
  ];

  return combinedKeywords.slice(0, 10);
};

/**
 * Calculate match score between task keywords and user skills
 * @param {Array} keywords - Task keywords
 * @param {Array} skills - User skills
 * @returns {number} Match score (0-100)
 */
const calculateMatchScore = (keywords, skills) => {
  if (!keywords.length || !skills.length) return 0;

  // Convert all to lowercase for case-insensitive matching
  const normalizedKeywords = keywords.map((k) => k.toLowerCase());
  const normalizedSkills = skills.map((s) => s.toLowerCase());

  // Count direct matches (exact matches between skills and keywords)
  let directMatches = 0;
  normalizedSkills.forEach((skill) => {
    if (normalizedKeywords.includes(skill)) {
      directMatches++;
    }
  });

  // Count partial matches with improved relevance scoring
  let partialMatches = 0;
  let partialMatchStrength = 0; // Measure how strong the partial matches are

  normalizedSkills.forEach((skill) => {
    normalizedKeywords.forEach((keyword) => {
      // Check if skill contains keyword or keyword contains skill
      if (skill.includes(keyword) || keyword.includes(skill)) {
        partialMatches++;

        // Calculate match strength based on length ratio
        // The closer the lengths, the stronger the match
        const lengthRatio =
          Math.min(skill.length, keyword.length) /
          Math.max(skill.length, keyword.length);

        partialMatchStrength += lengthRatio;
      }
    });
  });

  // Calculate scores with improved weighting
  // Direct matches are worth more than partial matches
  const directMatchScore =
    directMatches > 0 ? (directMatches / normalizedKeywords.length) * 70 : 0;

  // Partial match score considers both quantity and quality of matches
  const partialMatchScore =
    partialMatches > 0
      ? (partialMatchStrength / partialMatches) *
        (partialMatches /
          (normalizedKeywords.length * normalizedSkills.length)) *
        50
      : 0;

  // Add a small bonus for having multiple skills (skill diversity)
  const skillDiversityBonus = Math.min(10, skills.length * 2);

  return Math.min(
    100,
    Math.round(directMatchScore + partialMatchScore + skillDiversityBonus)
  );
};

/**
 * Recommend members for a task based on skills
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const recommendMembers = async (req, res) => {
  try {
    const { title, description, projectId } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: "Task title and description are required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: "Project ID is required",
      });
    }

    // Get project and its members
    const project = await Project.findById(projectId).populate(
      "members",
      "name email skills"
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      });
    }

    // Extract keywords from task title and description
    const keywords = await extractKeywords(title, description);
    console.log("Extracted keywords:", keywords);

    // Calculate match scores for each member
    const membersWithScores = project.members.map((member) => {
      const skills = member.skills || [];

      // If user has no skills, assign a base score based on random selection
      // This ensures users without skills still appear in recommendations
      let score = 0;
      if (skills.length === 0) {
        // Assign a random score between 10-30 for users without skills
        score = Math.floor(Math.random() * 21) + 10;
      } else {
        score = calculateMatchScore(keywords, skills);
      }

      return {
        _id: member._id,
        name: member.name,
        email: member.email,
        skills: skills,
        score: score,
        hasSkills: skills.length > 0,
      };
    });

    // Sort members by score (highest first)
    const sortedMembers = membersWithScores.sort((a, b) => {
      // First prioritize members with skills
      if (a.hasSkills && !b.hasSkills) return -1;
      if (!a.hasSkills && b.hasSkills) return 1;

      // Then sort by score
      return b.score - a.score;
    });

    res.json({
      success: true,
      keywords,
      recommendations: sortedMembers,
    });
  } catch (error) {
    console.error("Error recommending members:", error);
    res.status(500).json({
      success: false,
      error: "Error recommending members",
      details: error.message,
    });
  }
};

module.exports = {
  recommendMembers,
};
