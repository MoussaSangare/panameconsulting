import { toast } from 'react-toastify';

const API_URL = (import.meta as any).env.VITE_API_URL;

export interface Destination {
  _id: string;
  country: string;
  text: string;
  imagePath: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResponse {
  data: Destination[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CreateDestinationData {
  country: string;
  text: string;
  imageFile: File;
}

export interface UpdateDestinationData {
  country?: string;
  text?: string;
  imageFile?: File;
}

export interface Statistics {
  total: number;
  countries: number;
  lastUpdated: string | null;
}

class DestinationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_URL}/api/destinations`;
  }

  /**
   * Headers communs pour les requêtes authentifiées
   */
  private getAuthHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Gestion centralisée des erreurs
   */
  private handleError(error: any, defaultMessage: string): never {
    // Gestion d'erreur silencieuse en développement uniquement
    if (import.meta.env.DEV) {
      globalThis.console.error('❌ Erreur DestinationService:', error);
    }

    if (error.name === 'AbortError') {
      throw new Error('Timeout de la requête');
    }

    if (error.message?.includes('429')) {
      throw new Error('Trop de requêtes. Veuillez patienter.');
    }

    if (error.message?.includes('401')) {
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }

    if (error.message?.includes('403')) {
      throw new Error('Droits administrateur requis.');
    }

    if (error.message) {
      throw new Error(error.message);
    }

    throw new Error(defaultMessage);
  }

  /**
   * Récupérer toutes les destinations avec pagination
   */
  async getAllDestinations(
    page = 1,
    limit = 10,
    search?: string
  ): Promise<PaginatedResponse> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
      });

      const response = await globalThis.fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      this.handleError(error, 'Erreur lors du chargement des destinations');
    }
  }

  /**
   * Récupérer toutes les destinations sans pagination
   */
  async getAllDestinationsWithoutPagination(): Promise<Destination[]> {
    try {
      const response = await globalThis.fetch(`${this.baseUrl}/all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      this.handleError(error, 'Erreur lors du chargement des destinations');
    }
  }

  /**
   * Récupérer une destination par ID
   */
  async getDestinationById(id: string): Promise<Destination> {
    try {
      if (!id) {
        throw new Error('ID de destination requis');
      }

      const response = await globalThis.fetch(`${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Destination non trouvée');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      this.handleError(
        error,
        'Erreur lors de la récupération de la destination'
      );
    }
  }

  /**
   * Créer une nouvelle destination (Admin seulement)
   */
  async createDestination(
    data: CreateDestinationData,
    token: string
  ): Promise<Destination> {
    try {
      // Validation des données
      if (!data.country?.trim()) {
        throw new Error('Le nom du pays est obligatoire');
      }

      if (!data.text?.trim()) {
        throw new Error('La description est obligatoire');
      }

      if (!data.imageFile) {
        throw new Error("L'image est obligatoire");
      }

      if (data.text.length < 10 || data.text.length > 2000) {
        throw new Error(
          'La description doit contenir entre 10 et 2000 caractères'
        );
      }

      // Préparation FormData
      const formData = new FormData();
      formData.append('country', data.country.trim());
      formData.append('text', data.text.trim());
      formData.append('image', data.imageFile);

      const response = await globalThis.fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(token),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 409) {
          throw new Error('Cette destination existe déjà');
        }

        if (response.status === 401) {
          throw new Error('Token invalide ou expiré');
        }

        if (response.status === 403) {
          throw new Error('Droits administrateur requis');
        }

        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      const result = await response.json();
      toast.success('Destination créée avec succès');
      return result;
    } catch (error: any) {
      toast.error(error.message);
      this.handleError(error, 'Erreur lors de la création de la destination');
    }
  }

  /**
   * Mettre à jour une destination (Admin seulement)
   */
  async updateDestination(
    id: string,
    data: UpdateDestinationData,
    token: string
  ): Promise<Destination> {
    try {
      if (!id) {
        throw new Error('ID de destination requis');
      }

      // Validation des données
      if (data.country && data.country.trim().length === 0) {
        throw new Error('Le nom du pays ne peut pas être vide');
      }

      if (data.text && (data.text.length < 10 || data.text.length > 2000)) {
        throw new Error(
          'La description doit contenir entre 10 et 2000 caractères'
        );
      }

      // Préparation FormData
      const formData = new FormData();

      if (data.country) {
        formData.append('country', data.country.trim());
      }

      if (data.text) {
        formData.append('text', data.text.trim());
      }

      if (data.imageFile) {
        formData.append('image', data.imageFile);
      }

      const response = await globalThis.fetch(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(token),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 404) {
          throw new Error('Destination non trouvée');
        }

        if (response.status === 409) {
          throw new Error('Une destination avec ce nom existe déjà');
        }

        if (response.status === 401) {
          throw new Error('Token invalide ou expiré');
        }

        if (response.status === 403) {
          throw new Error('Droits administrateur requis');
        }

        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      const result = await response.json();
      toast.success('Destination modifiée avec succès');
      return result;
    } catch (error: any) {
      toast.error(error.message);
      this.handleError(
        error,
        'Erreur lors de la modification de la destination'
      );
    }
  }

  /**
   * Supprimer une destination (Admin seulement)
   */
  async deleteDestination(id: string, token: string): Promise<void> {
    try {
      if (!id) {
        throw new Error('ID de destination requis');
      }

      const response = await globalThis.fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: {
          ...this.getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 404) {
          throw new Error('Destination non trouvée');
        }

        if (response.status === 401) {
          throw new Error('Token invalide ou expiré');
        }

        if (response.status === 403) {
          throw new Error('Droits administrateur requis');
        }

        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      toast.success('Destination supprimée avec succès');
    } catch (error: any) {
      toast.error(error.message);
      this.handleError(
        error,
        'Erreur lors de la suppression de la destination'
      );
    }
  }

  /**
   * Récupérer les statistiques des destinations
   */
  async getStatistics(): Promise<Statistics> {
    try {
      // Pour l'instant, on utilise la liste complète pour calculer les stats
      // Vous pourriez ajouter un endpoint spécifique /api/destinations/stats dans le backend
      const destinations = await this.getAllDestinationsWithoutPagination();

      const uniqueCountries = new Set(
        destinations.map(dest => dest.country.toLowerCase().trim())
      );

      let lastUpdated: string | null = null;
      if (destinations.length > 0) {
        const dates = destinations
          .filter(dest => dest.updatedAt)
          .map(dest => new Date(dest.updatedAt!).getTime());

        if (dates.length > 0) {
          lastUpdated = new Date(Math.max(...dates)).toLocaleDateString(
            'fr-FR'
          );
        }
      }

      return {
        total: destinations.length,
        countries: uniqueCountries.size,
        lastUpdated,
      };
    } catch (error: any) {
      this.handleError(
        error,
        'Erreur lors de la récupération des statistiques'
      );
    }
  }

  /**
   * Rechercher des destinations
   */
  async searchDestinations(query: string): Promise<Destination[]> {
    try {
      if (!query.trim()) {
        return this.getAllDestinationsWithoutPagination();
      }

      const response = await this.getAllDestinations(1, 50, query.trim());
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Erreur lors de la recherche des destinations');
    }
  }

  /**
   * Valider une image avant upload
   */
  validateImageFile(file: File): { isValid: boolean; error?: string } {
    // Taille max: 5MB
    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: "L'image ne doit pas dépasser 5MB",
      };
    }

    // Types MIME autorisés
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
    ];
    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: "Format d'image non supporté. Utilisez JPEG, PNG, WEBP ou SVG",
      };
    }

    return { isValid: true };
  }

  /**
   * Générer l'URL complète d'une image
   */
  getFullImageUrl = (imagePath: string) => {
    if (!imagePath) return '/paname-consulting.jpg';

    // URLs déjà complètes
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }

    const baseUrl = API_URL;

    // Images dans public (par défaut) - utiliser le chemin relatif directement
    if (imagePath.startsWith('/')) {
      return imagePath;
    }

    // Images uploadées - construire l'URL complète avec le préfixe uploads
    let cleanPath = imagePath;

    // Si le chemin ne commence pas par 'uploads/', l'ajouter
    if (!cleanPath.startsWith('uploads/')) {
      cleanPath = `uploads/${cleanPath}`;
    }

    // Nettoyer les doubles slash
    cleanPath = cleanPath.replace(/\/\//g, '/');

    return `${baseUrl}/${cleanPath}`;
  };
}

// Export singleton
export const destinationService = new DestinationService();
export default DestinationService;
