/**
 * Featurebase API Client
 * Docs: https://docs.featurebase.app/rest-api/help-centers
 */

import axios from 'axios';

export class FeaturebaseClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://do.featurebase.app';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Featurebase-Version': '2026-01-01.nova'
      }
    });
  }

  /**
   * Get all help centers
   */
  async getHelpCenters() {
    const response = await this.client.get('/v2/help_center/help_centers');
    return response.data;
  }

  /**
   * Get a specific help center
   */
  async getHelpCenter(helpCenterId) {
    const response = await this.client.get(`/v2/help_center/help_centers/${helpCenterId}`);
    return response.data;
  }

  /**
   * Get all articles
   */
  async getArticles(params = {}) {
    const response = await this.client.get('/v2/help_center/articles', { params });
    return response.data;
  }

  /**
   * Get a specific article
   */
  async getArticle(articleId) {
    const response = await this.client.get(`/v2/help_center/articles/${articleId}`);
    return response.data;
  }

  /**
   * Create a new article
   */
  async createArticle(articleData) {
    const response = await this.client.post('/v2/help_center/articles', articleData);
    return response.data;
  }

  /**
   * Update an existing article
   */
  async updateArticle(articleId, articleData) {
    const response = await this.client.patch(
      `/v2/help_center/articles/${articleId}`,
      articleData
    );
    return response.data;
  }

  /**
   * Delete an article
   */
  async deleteArticle(articleId) {
    const response = await this.client.delete(`/v2/help_center/articles/${articleId}`);
    return response.data;
  }

  /**
   * Get all collections (categories)
   */
  async getCollections(params = {}) {
    const response = await this.client.get('/v2/help_center/collections', { params });
    return response.data;
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const helpCenters = await this.getHelpCenters();
      return {
        success: true,
        helpCenters: helpCenters
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        response: error.response?.data
      };
    }
  }
}
