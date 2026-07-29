export type ProductRecommendation = {
  id: string;
  customerId: string;
  productName: string;
  reason: string;
  confidence: number;
};

export type AnalyticsCustomerIdentity = {
  type: "externalId" | "email" | "phone" | "customerId";
  value: string;
};

export interface CustomerAnalyticsClient {
  getRecommendations(customerId: string): Promise<ProductRecommendation[]>;
}

export class StubCustomerAnalyticsClient implements CustomerAnalyticsClient {
  async getRecommendations(customerId: string): Promise<ProductRecommendation[]> {
    return [
      {
        id: `rec-${customerId}-analytics`,
        customerId,
        productName: "Advanced Analytics Add-on",
        reason: "Customer feedback indicates reporting and visibility needs.",
        confidence: 0.78
      }
    ];
  }
}
