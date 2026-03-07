import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useGetMealPlanById } from '@/features/meal-plan/queries';
import { useGetExchangeGroups } from '@/features/exchange-groups/queries';
import { useProfessionalClients } from '@/features/professional-clients/queries';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { useGetFoodsByExchangeGroup } from '@/features/foods/queries';
import { getFoodsByExchangeGroup } from '@/features/foods/api';
import { useGetRecipes } from '@/features/recipe-foods/queries';
import { RecipeFoodsService } from '@/features/recipe-foods/api';
import { useGetMenuById, useCreateMenu, useGenerateMenuAI, useSaveMenuDraft, useUpdateMenuDraft } from '@/features/menus/queries';
import { getDraftById } from '@/features/menus/api'; 
// I need a way to get a single draft by ID. 
// The user said: "get /v1/menus/draft" returns list. 
// "despues se va actualizar con un patch, /v1/menus/draft/:id"
// Usually there is a GET /v1/menus/draft/:id ? 
// If not, I can filter from the list if the user didn't implement GET by ID.
// The user request showed a GET for drafts (plural). 
// Let's assume I need to fetch the list and find the draft or implement getDraftById. 
// Users request image showed `getDrafts` taking params. It did not show `getDraftById`.
// Safest bet: fetch all drafts for professional and find the one with the ID. 
// OR simpler: The user said "el patch pide el id del draft, el id lo va a regresar el post".
// I will implement a quick `useGetDraftById` that fetches all and filters, OR (better) ask the API if it supports it. 
// Given the pattern, let's assume I can filter the list from `useGetDrafts`.

import { IFoodItem } from '@/features/foods/types';
import { MacroSidebar, MacroStats, MicronutrientStats } from '@/features/meal-plan/components/MacroSidebar';
import { Menu } from '@headlessui/react';
import { toast } from 'react-hot-toast';
import { Modal } from '@/components/common/Modal';
import { AssignMenuModal } from './components/AssignMenuModal';
import {
    ChevronLeft,
    Save,
    Utensils,
    Calendar,
    User,
    ChevronDown,
    Search,
    Sun,
    CloudSun,
    Moon,
    ArrowRight,
    FileText,
    ChefHat,
    Plus,
    X,
    Pencil,
    Trash,
    GripVertical,
    Sparkles,
    Loader2
} from 'lucide-react';
import { IMealPlanMeal, IMealPlanExchange } from '@/features/meal-plan/types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { differenceInCalendarDays } from 'date-fns';
import { DatePicker } from '@/components/common/DatePicker';
import { ClientHistoryPanel } from '@/components/ClientHistoryPanel';

const AI_MODELS = [
    { value: 'groq//llama-3.3-70b-versatile', label: 'Groq - Llama 3.3 70B' },
    { value: 'groq//llama-3.1-8b-instant', label: 'Groq - Llama 3.1 8B' },
    { value: 'openai//gpt-4o', label: 'OpenAI - GPT 4o' },
    { value: 'openai//gpt-4o-mini', label: 'OpenAI - GPT 4o Mini' },
    { value: 'deepseek//deepseek-chat', label: 'DeepSeek - Chat' },
    { value: 'deepseek//deepseek-reasoner', label: 'DeepSeek - Reasoner' },
    { value: 'gemini//gemini-2.5-flash-lite', label: 'Gemini - 2.5 Flash Lite' },
    { value: 'gemini//gemini-2.5-pro', label: 'Gemini - 2.5 Pro' },
    { value: 'gemini//gemini-2.5-flash', label: 'Gemini - 2.5 Flash' },
];

export function MenuCreationPage() {
    const [searchParams] = useSearchParams();

    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const planId = Number(searchParams.get('planId'));
    const clientId = Number(searchParams.get('clientId'));
    const fromMenuId = Number(searchParams.get('fromMenuId'));
    const draftIdParam = searchParams.get('draftId');

    const { professional } = useProfessional();
    const { data: plan, isLoading: planLoading } = useGetMealPlanById(planId);
    const { data: sourceMenu, isLoading: menuLoading } = useGetMenuById(fromMenuId);
    const { data: exchangeGroups } = useGetExchangeGroups();
    const { data: clients, isLoading: clientsLoading } = useProfessionalClients(professional?.sub || '');

    // Fetch drafts to find the one we might be loading
    // Optimization: In a real scenario, we'd want a specific getDraftById endpoint.
    // For now, fetching list and filtering.
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);

    useEffect(() => {
        const loadDraft = async () => {
            if (!draftIdParam) {
                // Reset state when no draft ID is present (New Menu Mode)
                setDraftId(null);
                setPeriod({ start: '', end: '' });
                setLocalMeals([]); // Will trigger plan loading effect if applicable
                setSelectedFoods({});
                setIsAiGeneratedDraft(false);
                setLastSavedHash('');
                // If we have query params like clientId, they stay in URL, so we don't need to clear them from state derived from URL
                return;
            }

            if (!professional?.sub) return;
            
            setIsLoadingDraft(true);
            try {
                // Fetch specific draft by ID
                const draft = await getDraftById(draftIdParam);

                if (draft && draft.json_data) {
                    const data = draft.json_data;
                    
                    if (data.period) setPeriod(data.period);
                    if (data.localMeals) {
                        setLocalMeals(data.localMeals);
                        if (data.localMeals.length > 0) {
                            setActiveTabId(data.localMeals[0].id || null);
                        }
                    }
                    if (data.selectedFoods) {
                        // Sanitize to remove shouldAutoOpen
                        const sanitizedFoods: Record<string, IFoodSelection[]> = {};
                        Object.entries(data.selectedFoods as Record<string, IFoodSelection[]>).forEach(([key, selections]) => {
                            sanitizedFoods[key] = selections.map(s => ({ ...s, shouldAutoOpen: false }));
                        });
                        setSelectedFoods(sanitizedFoods);
                    }
                    
                    setDraftId(draftIdParam); // draftIdParam is now string
                    if (draft.is_ai_generated) setIsAiGeneratedDraft(true);
                    
                    // If client is associated, maybe set it?
                    if (draft.client_id) {
                         // Check if clientId param is already set, if not, navigate or set it?
                         // Actually, we should probably redirect to include clientId in URL if it's not there?
                         // Or just let the state handle it? 
                         // The component reads clientId from URL.
                         if (!clientId) {
                             const newParams = new URLSearchParams(searchParams);
                             newParams.set('clientId', draft.client_id.toString());
                             navigate(`?${newParams.toString()}`, { replace: true });
                         }
                    }
                    
                    // Set hash to prevent immediate re-save
                    setLastSavedHash(JSON.stringify(data));
                    toast.success('Borrador cargado correctamente');
                }
            } catch (e) {
                console.error("Error loading draft", e);
                toast.error("Error al cargar el borrador");
            } finally {
                setIsLoadingDraft(false);
            }
        };

        loadDraft();
    }, [draftIdParam, professional?.sub]); // Add dependencies carefully




    const [period, setPeriod] = useState({ start: '', end: '' });
    const [selectedFoods, setSelectedFoods] = useState<Record<string, IFoodSelection[]>>({}); // mealExchangeKey -> IFoodSelection[]
    const [focusedMealId, setFocusedMealId] = useState<number | null>(null);

    // Template State


    const [loadingRecipeMealId, setLoadingRecipeMealId] = useState<number | null>(null);

    const [localMeals, setLocalMeals] = useState<IMealPlanMeal[]>([]);
    const [activeTabId, setActiveTabId] = useState<number | null>(null);
    const [editingTabId, setEditingTabId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');
    
    // Client Selection State
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [clientQuery, setClientQuery] = useState('');
    const [selectedClientIndex, setSelectedClientIndex] = useState(0);
    const [isAssignMenuModalOpen, setIsAssignMenuModalOpen] = useState(false);
    const [alternateMenuIds, setAlternateMenuIds] = useState<number[]>([]);

    // Draft State
    const [draftId, setDraftId] = useState<string | null>(null);
    const [isAiGeneratedDraft, setIsAiGeneratedDraft] = useState(false);
    const { mutate: saveDraft } = useSaveMenuDraft();
    const { mutate: updateDraft } = useUpdateMenuDraft();
    const [lastSavedHash, setLastSavedHash] = useState<string>('');

    // Auto-save Effect
    useEffect(() => {
        // Debounce 1.5s
        const timer = setTimeout(() => {
            // Allow saving if we have professional and meals, even if no client is selected yet
            if (!professional?.sub || localMeals.length === 0 || isProcessingAI) return;

            // Sanitize selectedFoods to remove transient state like shouldAutoOpen
            const sanitizedSelectedFoods: Record<string, IFoodSelection[]> = {};
            Object.entries(selectedFoods).forEach(([key, selections]) => {
                sanitizedSelectedFoods[key] = selections.map(s => {
                    const { shouldAutoOpen, ...rest } = s;
                    return rest;
                });
            });

            const payloadData = {
                localMeals,
                selectedFoods: sanitizedSelectedFoods,
                period,
                // Add any other critical state here
            };
            const currentHash = JSON.stringify(payloadData);

            if (currentHash === lastSavedHash) return;

            const payload = {
                professional_id: Number(professional.sub),
                client_id: clientId ? Number(clientId) : null,
                json_data: payloadData,
                is_ai_generated: isAiGeneratedDraft
            };

            console.log("Autosave triggered. Current draftId state:", draftId);

            if (!draftId) {
                console.log("Creating NEW draft...");
                saveDraft(payload, {
                    onSuccess: (data) => {
                        console.log("Draft created. Received ID:", data.id);
                        setDraftId(String(data.id));
                        setLastSavedHash(currentHash);
                        // Update URL to include the new draft ID
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('draftId', String(data.id));
                        // navigate(`?${newParams.toString()}`, { replace: true });
                        // Use window.history.replaceState to avoid re-triggering effects? 
                        // Or just navigate replacing.
                        // Ideally we DO want to update URL, but we don't want to reload data if it triggers loadDraft logic.
                        // loadDraft checks !draftIdParam. If we set it, it runs.
                        // But we already have the data in state.
                        navigate(`?${newParams.toString()}`, { replace: true });
                    }
                });
            } else {
                console.log("Updating EXISTING draft:", draftId);
                updateDraft({ id: draftId, data: payload }, {
                    onSuccess: () => {
                         setLastSavedHash(currentHash);
                    }
                });
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [localMeals, selectedFoods, period, clientId, draftId, isAiGeneratedDraft, professional, saveDraft, updateDraft, lastSavedHash]);

    const daysCount = useMemo(() => {
        if (!period.start || !period.end) return null;
        const start = new Date(period.start);
        const end = new Date(period.end);
        const diff = differenceInCalendarDays(end, start) + 1; // Inclusive
        return diff > 0 ? diff : null;
    }, [period.start, period.end]);



    const filteredClients = useMemo(() => {
        if (!clients) return [];
        return clientQuery === ''
            ? clients
            : clients.filter((c) =>
                (c.name || '').toLowerCase().replace(/\s+/g, '').includes(clientQuery.toLowerCase().replace(/\s+/g, '')) ||
                (c.email || '').toLowerCase().includes(clientQuery.toLowerCase())
            );
    }, [clientQuery, clients]);

    // Reset selection when query or visibility changes
    useEffect(() => {
        if (isClientModalOpen) setSelectedClientIndex(0);
    }, [clientQuery, isClientModalOpen]);

    // Keyboard Navigation for Client Modal
    useEffect(() => {
        if (!isClientModalOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedClientIndex(prev => Math.min(prev + 1, filteredClients.length - 1));
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedClientIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredClients[selectedClientIndex]) {
                    const c = filteredClients[selectedClientIndex];
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set('clientId', c.id.toString());
                    navigate(`?${newParams.toString()}`, { replace: true });
                    setIsClientModalOpen(false);
                }
            } else if (e.key === 'Escape') {
                setIsClientModalOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isClientModalOpen, filteredClients, selectedClientIndex, navigate, searchParams]);

    // Scroll selected client into view
    useEffect(() => {
        if (isClientModalOpen) {
            const el = document.getElementById(`client-card-${selectedClientIndex}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [selectedClientIndex, isClientModalOpen]);

    // Reusable Menu State
    const [isReusableModalOpen, setIsReusableModalOpen] = useState(false);
    const [reusableForm, setReusableForm] = useState({ title: '', description: '' });

    useEffect(() => {
        if (plan?.meal_plan_meals && localMeals.length === 0 && !fromMenuId) {
            setLocalMeals(plan.meal_plan_meals);
            if (plan.meal_plan_meals.length > 0) {
                setActiveTabId(plan.meal_plan_meals[0].id || null);
            }
        }
    }, [plan, localMeals.length, fromMenuId]);

    // Effect to load data from reusable menu
    useEffect(() => {
        if (sourceMenu && localMeals.length === 0 && exchangeGroups) {
            const transformedMeals: IMealPlanMeal[] = [];
            const newSelectedFoods: Record<string, IFoodSelection[]> = {};

            sourceMenu.menu_meals.forEach((meal, mealIdx) => {
                // 1. Group items by exchange group
                const exchangeGroupsInMeal: Record<number, number> = {}; // groupId -> sum(quantity)
                
                // Get the items array from the nested structure
                const items = meal.menu_items_menu_items_menu_meal_idTomenu_meals || [];
                
                items.forEach(item => {
                    if (item.exchange_group_id) {
                        exchangeGroupsInMeal[item.exchange_group_id] = (exchangeGroupsInMeal[item.exchange_group_id] || 0) + (item.quantity || 0);
                    }
                });

                // 2. Create exchanges
                const exchanges = Object.entries(exchangeGroupsInMeal).map(([groupIdStr, quantity]) => {
                    return {
                        id: -Math.floor(Math.random() * 1000000) - Number(groupIdStr), // Temp ID
                        exchange_group_id: Number(groupIdStr),
                        quantity: quantity, // Use the summed quantity (exchanges)
                        meal_plan_meal_id: 0
                    };
                });

                // 3. Create Meal
                const newMealId = -Math.floor(Math.random() * 1000000) - mealIdx;
                const newMeal: IMealPlanMeal = {
                    id: newMealId,
                    meal_name: meal.name,
                    sort_order: mealIdx + 1,
                    meal_plan_exchanges: exchanges
                };
                transformedMeals.push(newMeal);

                // 4. Populate selectedFoods for each exchange
                exchanges.forEach(ex => {
                    const key = `${newMealId}-${ex.id}`;
                    const groupItems = items.filter(i => i.exchange_group_id === ex.exchange_group_id);
                    const selections: IFoodSelection[] = [];

                    groupItems.forEach(item => {
                        if (item.food_id && item.foods) {
                            const food = item.foods;
                            // Calculate grams based on 'quantity' in menu_items. 
                            // In menu_items, quantity is typically the number of equivalents (exchanges).
                            // We need to calculate the GRAMS based on this equivalent count.
                            
                            const nutritionValue = food.food_nutrition_values?.[0]; // Should be included now
                            const baseSize = parseFloat(String(nutritionValue?.base_serving_size)) || 100;

                            // Assume item.quantity is EQUIVALENTS
                            let calculatedExchanges = item.quantity || 0;
                            let grams = 0;

                            if (nutritionValue && baseSize > 0) {
                                // Formula: Grams = Exchanges * BaseSize
                                grams = calculatedExchanges * baseSize;
                            } else {
                                // Fallback if no nutrition info (shouldn't happen often)
                                grams = calculatedExchanges * 100;
                            }
                           
                            selections.push({
                                foodId: food.id,
                                grams: Number(grams.toFixed(1)),
                                calculatedExchanges: calculatedExchanges,
                                nutritionValueId: nutritionValue?.id,
                                _foodRef: food,
                                isFromRecipe: !!item.recipe_id
                            });
                        }
                    });

                    // Pad with empty selections if total selections < exchange quantity? 
                    // Usually we don't enforce this strictly here, but good to have at least one or match count.
                    // If no foods selected but exchange exists, add empty placeholders
                    if (selections.length === 0) {
                         const numSelectors = Math.ceil(ex.quantity);
                         for(let i=0; i<numSelectors; i++) {
                             selections.push({ grams: 0, calculatedExchanges: 0 });
                         }
                    }

                    newSelectedFoods[key] = selections;
                });
            });

            setLocalMeals(transformedMeals);
            setSelectedFoods(newSelectedFoods);
            if (transformedMeals.length > 0) {
                setActiveTabId(transformedMeals[0].id || null);
            }
        }
    }, [sourceMenu, localMeals.length, exchangeGroups]);

    // Keep focusedMealId for compatibility with existing sidebar logic, sync with activeTabId
    useEffect(() => {
        setFocusedMealId(activeTabId);
    }, [activeTabId]);

    interface IFoodSelection {
        foodId?: number;
        grams: number;
        calculatedExchanges: number;
        nutritionValueId?: number;
        _foodRef?: IFoodItem; // Temporary ref for calculations
        isFromRecipe?: boolean;
        shouldAutoOpen?: boolean;
    }

    const client = useMemo(() => clients?.find(c => c.id === clientId), [clients, clientId]);

    const groupsMap = useMemo(() => {
        if (!exchangeGroups) return {};
        return exchangeGroups.reduce((acc, g) => {
            acc[g.id] = g;
            return acc;
        }, {} as Record<number, any>);
    }, [exchangeGroups]);

    const stats = useMemo(() => {
        const meals: Record<number, MacroStats> = {};
        const mealsMicros: Record<number, MicronutrientStats> = {};
        const global: MacroStats = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, glycemicLoad: 0 };
        const globalMicros: MicronutrientStats = {};

        localMeals.forEach(meal => {
            const mealTotal: MacroStats = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, glycemicLoad: 0 };
            const mealTotalMicros: MicronutrientStats = {};

            meal.meal_plan_exchanges?.forEach(ex => {
                const selections = selectedFoods[`${meal.id}-${ex.id}`] || [];
                selections.forEach(sel => {
                    const food = sel._foodRef;
                    if (!food) return;

                    const nutritionValue = food.food_nutrition_values?.find(nv => nv.id === sel.nutritionValueId)
                        || food.food_nutrition_values?.[0];

                    if (nutritionValue) {
                        const grams = sel.grams;
                        const baseSize = parseFloat(String(nutritionValue.base_serving_size)) || 1;
                        const ratio = grams / baseSize;

                        mealTotal.calories += (parseFloat(String(nutritionValue.calories_kcal)) || 0) * ratio;
                        mealTotal.protein += (parseFloat(String(nutritionValue.protein_g)) || 0) * ratio;
                        mealTotal.carbs += (parseFloat(String(nutritionValue.carbs_g)) || 0) * ratio;
                        mealTotal.fat += (parseFloat(String(nutritionValue.fat_g)) || 0) * ratio;
                        
                        // Calculate fiber
                        // Check if fiber_g exists on nutritionValue (it should based on updated types)
                        // Fallback to food level if not in NV (though types show it in NV now)
                        const fiber = parseFloat(String(nutritionValue.fiber_g || food.fiber_g || 0));
                        if(mealTotal.fiber !== undefined) mealTotal.fiber += fiber * ratio;

                        const gl = parseFloat(String(nutritionValue.glycemic_load || food.glycemic_load)) || 0;
                        if (mealTotal.glycemicLoad !== undefined) mealTotal.glycemicLoad += gl * ratio;

                        // Calculate Micronutrients
                        const microValues = nutritionValue.food_micronutrient_values || [];
                        // Fallback to food.micronutrients if nutrition values don't have them but food does (legacy or flat structure)
                        // Note: current types.ts structure puts detailed micros in food_micronutrient_values
                        
                        microValues.forEach(mv => {
                            if (mv.micronutrients) {
                                const amount = (parseFloat(String(mv.amount)) || 0) * ratio;
                                const key = mv.micronutrients.name;
                                
                                // Add to meal micros
                                if (!mealTotalMicros[key]) {
                                    mealTotalMicros[key] = { 
                                        amount: 0, 
                                        unit: mv.micronutrients.unit, 
                                        name: key,
                                        category: mv.micronutrients.category
                                    };
                                }
                                mealTotalMicros[key].amount += amount;

                                // Add to global micros
                                if (!globalMicros[key]) {
                                    globalMicros[key] = { 
                                        amount: 0, 
                                        unit: mv.micronutrients.unit, 
                                        name: key,
                                        category: mv.micronutrients.category
                                    };
                                }
                                globalMicros[key].amount += amount;
                            }
                        });
                        
                        // Handle flat micronutrients array on food item if present (from recent API change)
                        if (food.micronutrients && (!microValues || microValues.length === 0)) {
                             food.micronutrients.forEach(m => {
                                const amount = (parseFloat(String(m.amount)) || 0) * ratio;
                                const key = m.name;

                                 if (!mealTotalMicros[key]) {
                                    mealTotalMicros[key] = { 
                                        amount: 0, 
                                        unit: m.unit, 
                                        name: key,
                                        category: m.category
                                    };
                                }
                                mealTotalMicros[key].amount += amount;

                                if (!globalMicros[key]) {
                                    globalMicros[key] = { 
                                        amount: 0, 
                                        unit: m.unit, 
                                        name: key,
                                        category: m.category
                                    };
                                }
                                globalMicros[key].amount += amount;
                             });
                        }
                    }
                });
            });

            if (meal.id) {
                meals[meal.id] = mealTotal;
                mealsMicros[meal.id] = mealTotalMicros;
            }
            global.calories += mealTotal.calories;
            global.protein += mealTotal.protein;
            global.carbs += mealTotal.carbs;
            global.fat += mealTotal.fat;
            if (global.fiber !== undefined && mealTotal.fiber !== undefined) {
                global.fiber += mealTotal.fiber;
            }
            if (global.glycemicLoad !== undefined && mealTotal.glycemicLoad !== undefined) {
                global.glycemicLoad += mealTotal.glycemicLoad;
            }
        });

        return { meals, global, mealsMicros, globalMicros };
    }, [localMeals, selectedFoods]);

    const focusedMeal = useMemo(() =>
        localMeals.find(m => m.id === focusedMealId),
        [localMeals, focusedMealId]
    );

    useEffect(() => {
        if (!focusedMealId && plan?.meal_plan_meals?.[0]) {
            setFocusedMealId(plan.meal_plan_meals[0].id || null);
        }
    }, [plan, focusedMealId]);

    // State moved up


    const handleAddTab = () => {
        let newExchanges: IMealPlanExchange[] = [];

        if (localMeals.length > 0) {
            // Clone structure of the first meal (or currently active) to get exchange groups
            const template = localMeals[0];
            newExchanges = template.meal_plan_exchanges?.map(ex => ({
                ...ex,
                id: -Math.floor(Math.random() * 1000000), // temp ID
                quantity: 0 // Start empty
            })) || [];
        } else if (exchangeGroups) {
             // Create default structure from exchange groups
            newExchanges = exchangeGroups.map(group => ({
                id: -Math.floor(Math.random() * 1000000) - group.id,
                exchange_group_id: group.id,
                quantity: 0,
                meal_plan_meal_id: 0
            }));
        }

        const newMeal: IMealPlanMeal = {
            id: -Math.floor(Math.random() * 1000000), // temp ID
            meal_name: `Comida ${localMeals.length + 1}`,
            sort_order: localMeals.length + 1,
            meal_plan_exchanges: newExchanges
        };

        setLocalMeals([...localMeals, newMeal]);
        setActiveTabId(newMeal.id || null);
    };

    const handleRenameTab = (id: number, newName: string) => {
        setLocalMeals(localMeals.map(m => m.id === id ? { ...m, meal_name: newName } : m));
        setEditingTabId(null);
    };

    const handleDeleteTab = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const newMeals = localMeals.filter(m => m.id !== id);
        setLocalMeals(newMeals);
        if (activeTabId === id && newMeals.length > 0) {
            setActiveTabId(newMeals[0].id || null);
        }
    };


    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setLocalMeals((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const { mutate: createMenu, isPending: isSaving } = useCreateMenu();

    const handleSaveMenu = (options?: { isReusable?: boolean, title?: string, description?: string }) => {
        // Validation logic
        // If not reusable OR (reusable AND client selected), require dates
        const requiresDates = !options?.isReusable || (options?.isReusable && clientId);
        
        if (requiresDates && (!period.start || !period.end)) {
            toast.error('Por favor selecciona un periodo para el menú');
            return;
        }

        if (options?.isReusable && !options.title) {
            toast.error('El título es obligatorio para menús reutilizables');
            return;
        }

        // Determine client and dates based on logic
        const targetClientId = (options?.isReusable && !clientId) ? null : clientId;
        const targetStartDate = (options?.isReusable && !clientId) ? new Date().toISOString() : period.start;
        const targetEndDate = (options?.isReusable && !clientId) ? new Date().toISOString() : period.end;

        // Transform selectedFoods and localMeals for saving
        const menuData = {
            meal_plan_id: planId || null,
            client_id: targetClientId,
            start_date: targetStartDate,
            end_date: targetEndDate,
            created_by: professional?.sub ? Number(professional.sub) : null, // Assuming sub (subject/id) is a numeric string
            is_reusable: options?.isReusable || false,
            title: options?.title || '',
            description: options?.description || '', // Sending both to ensure backend compat
            description_: options?.description || '', // Note: payload expects description_ (based on IMenu interface) or check backend DTO
            alternate_menu_ids: alternateMenuIds,
            menu_meals: localMeals.map(meal => ({
                name: meal.meal_name,
                source_meal_plan_meal_id: meal.id && meal.id > 0 ? meal.id : null,
                menu_items: (meal.meal_plan_exchanges || []).flatMap(ex => {
                    const key = `${meal.id}-${ex.id}`;
                    const selections = selectedFoods[key] || [];

                    return selections.filter(s => s.foodId).map(sel => ({
                        exchange_group_id: ex.exchange_group_id,
                        food_id: sel.foodId,
                        quantity: sel.grams,
                        equivalent_quantity: sel.calculatedExchanges,
                        serving_unit_id: null, // Default to grams for now
                        recipe_id: null // Tracking recipe ID is not fully supported in local state yet
                    }));
                })
            }))
        };

        console.log('Saving Menu Payload:', menuData);

        createMenu(menuData as any, {
            onSuccess: () => {
                if (options?.isReusable) {
                    toast.success('Menú reutilizable creado con éxito');
                    navigate('/nutrition/meal-plans/reusable-menus');
                } else {
                    toast.success('Menú guardado con éxito');
                    navigate('/nutrition/meal-plans/overview');
                }
            }
        });
    };

    const handleConfirmReusable = () => {
        if (!reusableForm.title.trim()) {
            toast.error('El título es obligatorio');
            return;
        }
        handleSaveMenu({
            isReusable: true,
            title: reusableForm.title,
            description: reusableForm.description
        });
        setIsReusableModalOpen(false);
    };

    const [isAiOptionsModalOpen, setIsAiOptionsModalOpen] = useState(false);
    const [aiNotes, setAiNotes] = useState('');
    const [selectedAiModel, setSelectedAiModel] = useState(AI_MODELS[0].value);

    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const { mutateAsync: generateAIAsync } = useGenerateMenuAI();

    const handleOpenAiModal = () => {
        setAiNotes('');
        setIsAiOptionsModalOpen(true);
    };

    const handleConfirmGenerateAI = async () => {
        if (!client) return;
        setIsAiOptionsModalOpen(false);
        setIsProcessingAI(true);
        
        try {
            const aiData = await generateAIAsync({
                client_id: client.id,
                extra_notes: aiNotes || undefined,
                language: 'ES', // Default
                data_system: 'SMAE', // Default
                model: selectedAiModel
            });

            // 1. Update Period
            if (aiData.start_date && aiData.end_date) {
               setPeriod({
                   start: aiData.start_date,
                   end: aiData.end_date
               });
            }

            // 2. Fetch required foods
            const groupIds = new Set<number>();
            aiData.menu_meals.forEach((meal: any) => {
                meal.menu_items.forEach((item: any) => {
                    if (item.exchange_group_id) groupIds.add(item.exchange_group_id);
                });
            });

            const foodsMap: Record<number, IFoodItem> = {};
            
            await Promise.all(Array.from(groupIds).map(async (groupId) => {
                const foods = await queryClient.fetchQuery({
                    queryKey: ["foods", "exchange-group", groupId],
                    queryFn: () => getFoodsByExchangeGroup(groupId)
                });
                foods.forEach(f => {
                    foodsMap[f.id] = f;
                });
            }));

            // 3. Process Meals
            const transformedMeals: IMealPlanMeal[] = [];
            const newSelectedFoods: Record<string, IFoodSelection[]> = {};

             aiData.menu_meals.forEach((meal: any, mealIdx: number) => {
                const exchangeGroupsInMeal: Record<number, number> = {}; 
                const items = meal.menu_items || [];

                items.forEach((item: any) => {
                    if (item.exchange_group_id) {
                        exchangeGroupsInMeal[item.exchange_group_id] = (exchangeGroupsInMeal[item.exchange_group_id] || 0) + (item.equivalent_quantity || 0);
                    }
                });

                 const exchanges = Object.entries(exchangeGroupsInMeal).map(([groupIdStr, quantity]) => {
                    return {
                        id: -Math.floor(Math.random() * 1000000) - Number(groupIdStr) - mealIdx * 1000, 
                        exchange_group_id: Number(groupIdStr),
                        quantity: quantity, 
                        meal_plan_meal_id: 0
                    };
                });

                const newMealId = -Math.floor(Math.random() * 1000000) - mealIdx;
                const newMeal: IMealPlanMeal = {
                    id: newMealId,
                    meal_name: meal.name,
                    sort_order: mealIdx + 1,
                    meal_plan_exchanges: exchanges
                };
                transformedMeals.push(newMeal);

                exchanges.forEach(ex => {
                    const key = `${newMealId}-${ex.id}`;
                    const groupItems = items.filter((i: any) => i.exchange_group_id === ex.exchange_group_id);
                    const selections: IFoodSelection[] = [];

                    groupItems.forEach((item: any) => {
                        const food = foodsMap[item.food_id];
                        if (food) {
                            const nutritionValue = food.food_nutrition_values?.[0];
                            
                            // Calculate grams from equivalents (item.quantity is grams? No, wait. item in AI response has equivalent_quantity)
                            // In AI response: item.quantity (might be grams or count) and item.equivalent_quantity (exchanges).
                            // The user said "grams coming back wrong". Trust equivalent_quantity.
                            
                            let calculatedExchanges = item.equivalent_quantity || 0;
                            let grams = item.quantity || 0; 

                            // Recalculate grams to be safe
                            if (nutritionValue && calculatedExchanges > 0) {
                                // We need avgCal for the group. 
                                // groupsMap might not be fully available here as we are in async function?
                                // We can try to find it from the fetched foods or pass it.
                                // But simpler: The food usually knows its exchange group.
                                // Fetching foods also returns exchange group data usually? 
                                // Actually getFoodsByExchangeGroup returns IFoodItem which has exchange_groups nested?
                                // Let's check IFoodItem interface. It has exchange_groups: IExchangeGroup.
                                
                                // group is not needed for new calculation
                                const baseSize = parseFloat(String(nutritionValue.base_serving_size)) || 1;

                                if (baseSize > 0) {
                                    grams = calculatedExchanges * baseSize;
                                }
                            }

                             selections.push({
                                foodId: food.id,
                                grams: Number(grams.toFixed(1)),
                                calculatedExchanges: calculatedExchanges,
                                nutritionValueId: nutritionValue?.id,
                                _foodRef: food,
                                isFromRecipe: false
                            });
                        }
                    });
                    
                    newSelectedFoods[key] = selections;
                });

             });

             setLocalMeals(transformedMeals);
             setSelectedFoods(newSelectedFoods);
             if (transformedMeals.length > 0) {
                 setActiveTabId(transformedMeals[0].id || null);
             }

             // Auto update title/description if provided by AI? (Optional)
             setIsAiGeneratedDraft(true);
             
        } catch (error) {
            console.error('AI Gen Error:', error);
            // toast.error('Error al generar el menú'); Handled by mutation usage, but mutation onError is void now? 
            // We used mutateAsync, which might throw.
        } finally {
            setIsProcessingAI(false);
        }
    };


    // Only wait for loading if we are actually fetching something
    const isGlobalLoading = (!!planId && planLoading) || (!!fromMenuId && menuLoading) || clientsLoading || isProcessingAI || isLoadingDraft;

    // Remove early return, handle loading inside main layout

    return (
        <div className="min-h-screen bg-gray-50/50 pb-32 flex flex-col">
            {/* Top Bar - Centered relative to content or full width? Full width usually better for headers */}
            <div className="max-w-[1400px] w-full mx-auto px-4 md:px-8 pt-8 transition-all duration-300" style={{ paddingRight: focusedMealId ? '40vw' : '2rem' }}>
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors group"
                    >
                        <div className="p-2 bg-white rounded-full border border-gray-100 group-hover:bg-gray-50 shadow-sm transition-all group-hover:-translate-x-1">
                            <ChevronLeft className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold uppercase tracking-widest">Regresar</span>
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight">Editando</p>
                            <p className="text-sm font-black text-gray-900 tracking-tight leading-tight">Semana 1</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-start gap-8 px-4 md:px-8 max-w-[1920px] mx-auto w-full relative">
                {/* Main Content Area - Resizes when sidebar opens by adding margin */}
                <motion.div
                    layout
                    className="flex-1 min-w-0 space-y-8"
                    initial={false}
                    animate={{ marginRight: focusedMealId ? '40vw' : '0' }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {/* Header / Context */}
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-8 md:p-10 ring-1 ring-gray-900/5 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <Utensils className="w-32 h-32" />
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                        Nuevo Menú
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <ArrowRight className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-tight">Basado en plantilla</span>
                                    </div>
                                </div>
                                <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none">
                                    Creación de menú para <span className="text-emerald-600">{client?.name || 'Cliente'}</span>
                                </h1>
                            </div>

                            <div className="flex flex-wrap items-center gap-6">
                                <div className="flex items-center gap-2 text-gray-500">
                                    <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-100">
                                        <Utensils className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <span className="text-sm font-bold">{plan?.name}</span>
                                </div>
                                
                                {/* Client Selector Trigger */}
                                <div 
                                    className="relative min-w-[250px] cursor-pointer group"
                                    onClick={() => setIsClientModalOpen(true)}
                                >
                                    <div 
                                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-2xl shadow-sm hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/20 transition-all"
                                    >
                                        <div className={`
                                            w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black uppercase
                                            ${client ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}
                                        `}>
                                            {client?.profile_picture ? (
                                                <img src={client.profile_picture} alt={client.name} className="w-full h-full rounded-xl object-cover" />
                                            ) : (
                                                client ? (client.name || '').charAt(0) : <User className="w-5 h-5" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">
                                                {client ? 'Cliente seleccionado' : 'Asignar a cliente'}
                                            </p>
                                            <p className="text-sm font-bold text-gray-900 truncate">
                                                {client ? client.name : 'Seleccionar cliente...'}
                                            </p>
                                        </div>
                                        <ChevronDown className="w-5 h-5 text-gray-300" />
                                    </div>
                                    
                                    {client && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newParams = new URLSearchParams(searchParams);
                                                newParams.delete('clientId');
                                                navigate(`?${newParams.toString()}`, { replace: true });
                                            }}
                                            className="absolute -top-2 -right-2 p-1.5 bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-100 rounded-full shadow-sm transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                                            title="Quitar cliente"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {client && (
                                    <button
                                        onClick={() => setIsAssignMenuModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors text-sm font-bold border border-emerald-100 h-[38px]"
                                    >
                                        <FileText className="w-4 h-4" />
                                        <span>Asignar menús</span>
                                    </button>
                                )}

                                {client && (
                                    <button
                                        onClick={handleOpenAiModal}
                                        disabled={isProcessingAI}
                                        className={`flex items-center gap-2 px-4 py-2 bg-linear-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all text-sm font-black border border-transparent h-[38px] ${isProcessingAI ? 'opacity-75 cursor-not-allowed' : ''}`}
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        <span>Generar con IA</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI Loading Modal */}
                    <Modal
                        isOpen={isProcessingAI}
                        onClose={() => {}} // Block closing
                        size="sm"
                    >
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-violet-500 blur-xl opacity-20 rounded-full animate-pulse" />
                                <div className="relative p-4 bg-white rounded-full shadow-lg border border-violet-100">
                                    <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-gray-900">
                                    Generando Menú Inteligente
                                </h3>
                                <p className="text-sm text-gray-500 font-medium max-w-[280px] mx-auto leading-relaxed">
                                    Estamos analizando las preferencias y necesidades de tu cliente para crear el plan ideal...
                                </p>
                            </div>

                            <div className="flex gap-1.5 justify-center">
                                <div className="w-2 h-2 rounded-full bg-violet-600/20 animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-2 h-2 rounded-full bg-violet-600/20 animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-2 h-2 rounded-full bg-violet-600/20 animate-bounce" />
                            </div>
                        </div>
                    </Modal>

                    {/* AI Options Modal */}
                    <Modal
                        isOpen={isAiOptionsModalOpen}
                        onClose={() => setIsAiOptionsModalOpen(false)}
                        title="Generar Menú con IA"
                        size="md"
                    >
                        <div className="space-y-6 pt-4">
                            <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl flex items-start gap-3">
                                <Sparkles className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
                                <p className="text-sm text-violet-800">
                                    La IA analizará el perfil del cliente para generar un menú personalizado. Puedes añadir instrucciones adicionales abajo.
                                </p>
                            </div>



                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                    Modelo de IA
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedAiModel}
                                        onChange={(e) => setSelectedAiModel(e.target.value)}
                                        className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-violet-500 outline-none transition-all appearance-none cursor-pointer hover:bg-white hover:border-violet-200"
                                    >
                                        {AI_MODELS.map(model => (
                                            <option key={model.value} value={model.value}>
                                                {model.label}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <ChevronDown className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                    Notas o Instrucciones Extra (Opcional)
                                </label>
                                <textarea
                                    value={aiNotes}
                                    onChange={(e) => setAiNotes(e.target.value)}
                                    placeholder="Ej. Evitar lácteos en la cena, priorizar desayunos rápidos, incluir más fibra..."
                                    rows={4}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-violet-500 outline-none transition-all placeholder:text-gray-400 resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setIsAiOptionsModalOpen(false)}
                                    className="px-5 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all uppercase tracking-wide"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        if (localMeals.length > 0 || draftId) {
                                            if (window.confirm("Se generará un NUEVO menú basado en tus preferencias. Esto creará un borrador nuevo y no sobrescribirá el actual. ¿Deseas continuar?")) {
                                                // Reset draft ID to force creation of a new draft
                                                setDraftId(null);
                                                setLastSavedHash(''); // Reset hash to trigger autosave
                                                // Clear URL draftId
                                                const newParams = new URLSearchParams(searchParams);
                                                newParams.delete('draftId');
                                                navigate(`?${newParams.toString()}`, { replace: true });
                                                
                                                handleConfirmGenerateAI();
                                            }
                                        } else {
                                            handleConfirmGenerateAI();
                                        }
                                    }}
                                    className="px-6 py-2.5 bg-linear-to-r from-violet-600 to-fuchsia-600 hover:shadow-lg hover:shadow-violet-500/25 text-white rounded-xl font-bold transition-all hover:-translate-y-0.5 uppercase tracking-wide text-xs"
                                >
                                    Generar Menú
                                </button>
                            </div>
                        </div>
                    </Modal>





                            {client && (
                                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4 min-w-[300px]">
                                    <div className="flex items-center justify-between gap-2 px-1">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <Calendar className="w-3.5 h-3.5" />
                                            Periodo del Menú
                                        </div>
                                        {!!daysCount && daysCount > 0 && (
                                            <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                {daysCount} {daysCount === 1 ? 'día' : 'días'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 transition-opacity duration-200">
                                        <DatePicker
                                            label="Inicio"
                                            value={period.start}
                                            onChange={(date: string) => setPeriod({ ...period, start: date })}
                                            placeholder="dd/mm/aaaa"
                                            disabled={!client}
                                        />
                                        <DatePicker
                                            label="Fin"
                                            value={period.end}
                                            onChange={(date: string) => setPeriod({ ...period, end: date })}
                                            placeholder="dd/mm/aaaa"
                                            disabled={!client}
                                        />
                                    </div>
                                    
                                    <ClientHistoryPanel 
                                        clientId={client.id} 
                                        currentCalories={stats.global.calories}
                                    />
                                </div>
                            )}



                    {/* Main Content Area */}
                    <div className="space-y-8">
                        {isGlobalLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-[2.5rem] border border-gray-100/50 backdrop-blur-sm">
                                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-4" />
                                <p className="text-gray-500 font-medium tracking-wide">
                                    {isProcessingAI ? 'Generando menú con IA...' : 'Cargando constructor de menú...'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Tab Navigation */}
                                <div className="flex flex-wrap items-center gap-2 pb-2">
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={localMeals.map(m => m.id!)}
                                            strategy={horizontalListSortingStrategy}
                                        >
                                            {localMeals.map((meal) => (
                                                <SortableMealTab
                                                    key={meal.id}
                                                    meal={meal}
                                                    activeTabId={activeTabId}
                                                    setActiveTabId={setActiveTabId}
                                                    editingTabId={editingTabId}
                                                    setEditingTabId={setEditingTabId}
                                                    renameValue={renameValue}
                                                    setRenameValue={setRenameValue}
                                                    handleRenameTab={handleRenameTab}
                                                    handleDeleteTab={handleDeleteTab}
                                                    mealsCount={localMeals.length}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>

                                    <button
                                        onClick={handleAddTab}
                                        className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-emerald-500 hover:border-emerald-200 hover:bg-emerald-50 transition-all shrink-0"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Active Meal Content */}
                                <div className="space-y-8">
                                    {localMeals.filter(m => m.id === activeTabId).map((meal) => (
                                        <div
                                            key={meal.id}
                                            className={`bg-white rounded-[2.5rem] shadow-lg shadow-gray-200/40 border border-gray-100 transition-all overflow-hidden`}
                                        >
                                            {/* Meal Header */}
                                            <div className={`px-8 py-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors bg-white`}>
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-gray-100">
                                                        <MealIcon name={meal.meal_name || ''} />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">{meal.meal_name}</h2>
                                                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                                            {meal.meal_plan_exchanges?.reduce((acc, ex) => acc + (ex.quantity || 0), 0) || 0} equivalentes
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {/* Disassemble Recipe Button */}
                                                    {meal.meal_plan_exchanges?.some(ex => {
                                                        const key = `${meal.id}-${ex.id}`;
                                                        return selectedFoods[key]?.some(s => s.isFromRecipe);
                                                    }) && (
                                                            <button
                                                                onClick={() => {
                                                                    const newSelectedFoods = { ...selectedFoods };
                                                                    let changed = false;

                                                                    meal.meal_plan_exchanges?.forEach(ex => {
                                                                        const key = `${meal.id}-${ex.id}`;
                                                                        if (newSelectedFoods[key]) {
                                                                            const originalLen = newSelectedFoods[key].length;
                                                                            const filtered = newSelectedFoods[key].filter(s => !s.isFromRecipe);
                                                                            if (filtered.length !== originalLen) {
                                                                                newSelectedFoods[key] = filtered;
                                                                                changed = true;
                                                                            }
                                                                        }
                                                                    });

                                                                    if (changed) {
                                                                        setSelectedFoods(newSelectedFoods);
                                                                        toast.success("Receta desarmada");
                                                                    }
                                                        }}
                                                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors uppercase tracking-wide flex items-center gap-2"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        Desarmar Receta
                                                    </button>
                                                )}

                                            <RecipeSelector
                                                isLoading={loadingRecipeMealId === meal.id}
onSelect={async (recipeId) => {
                                                    if (meal.id) setLoadingRecipeMealId(meal.id);
                                                    try {
                                                        const recipeFoods = await RecipeFoodsService.getByRecipeId(recipeId);
                                                        
                                                        // Clone current state to modify
                                                        const updatedMeals = [...localMeals];
                                                        const mealIndex = updatedMeals.findIndex(m => m.id === meal.id);
                                                        if (mealIndex === -1) throw new Error("Meal not found");
                                                        
                                                        const currentMeal = { ...updatedMeals[mealIndex] };
                                                        currentMeal.meal_plan_exchanges = [...(currentMeal.meal_plan_exchanges || [])]; // Clone exchanges

                                                        const newSelectedFoods = { ...selectedFoods };
                                                        let newGroupsAdded = false;

                                                        // Use Promise.all to handle async fetching for all items first
                                                        const processedFoods = await Promise.all(recipeFoods.map(async (rf) => {
                                                            const partialFood = rf.foods;
                                                            if (!partialFood) return null;

                                                            let fullFood: IFoodItem = partialFood;
                                                            // Fetch complete food details if needed
                                                            if (!partialFood.food_nutrition_values || partialFood.food_nutrition_values.length === 0) {
                                                                try {
                                                                    const groupFoods = await queryClient.fetchQuery({
                                                                        queryKey: ['foods', 'exchange-group', partialFood.exchange_group_id],
                                                                        queryFn: () => getFoodsByExchangeGroup(partialFood.exchange_group_id),
                                                                        staleTime: 1000 * 60 * 5
                                                                    });
                                                                    fullFood = groupFoods.find(f => f.id === partialFood.id) || partialFood;
                                                                } catch (err) {
                                                                    console.error("Error fetching food details", err);
                                                                }
                                                            }
                                                            return { rf, fullFood };
                                                        }));

                                                        processedFoods.forEach((item) => {
                                                            if (!item) return;
                                                            const { rf, fullFood } = item;
                                                            
                                                            // Find matching exchange group in this meal
                                                            let matchingExchange = currentMeal.meal_plan_exchanges?.find(
                                                                ex => ex.exchange_group_id === fullFood.exchange_group_id
                                                            );

                                                            // Calculate grams/exchanges
                                                            const nutritionValue = fullFood.food_nutrition_values?.[0];
                                                            
                                                            let grams = 0;
                                                            const servingUnit = fullFood.serving_units?.find(u => u.id === rf.serving_unit_id);
                                                            if (servingUnit) {
                                                                grams = (parseFloat(String(rf.quantity)) || 0) * (parseFloat(String(servingUnit.gram_equivalent)) || 0);
                                                            } else {
                                                                grams = (parseFloat(String(rf.quantity)) || 0) * 100; // Default assumption if no unit
                                                            }

                                                            const baseSize = parseFloat(String(nutritionValue?.base_serving_size)) || 1;

                                                            let calculatedExchanges = 0;
                                                            if (nutritionValue && baseSize > 0) {
                                                                calculatedExchanges = grams / baseSize;
                                                            }

                                                            // IF MISSING: CREATE IT
                                                            if (!matchingExchange) {
                                                                const newExchangeId = -Math.floor(Math.random() * 10000000) - fullFood.exchange_group_id; // Unique negative ID
                                                                
                                                                matchingExchange = {
                                                                    id: newExchangeId,
                                                                    exchange_group_id: fullFood.exchange_group_id!,
                                                                    quantity: Math.ceil(calculatedExchanges) || 1, // Set target 
                                                                    meal_plan_meal_id: currentMeal.id || 0
                                                                };
                                                                
                                                                if (!currentMeal.meal_plan_exchanges) currentMeal.meal_plan_exchanges = [];
                                                                currentMeal.meal_plan_exchanges.push(matchingExchange);
                                                                newGroupsAdded = true;
                                                            } else {
                                                                // If it exists, maybe we should increase the quantity/target if it's overflowing? 
                                                                // For now let's just use it.
                                                            }

                                                            const key = `${currentMeal.id}-${matchingExchange.id}`;
                                                            // Ensure array exists
                                                            if (!newSelectedFoods[key]) newSelectedFoods[key] = [];
                                                            else newSelectedFoods[key] = [...newSelectedFoods[key]];

                                                            const currentSelections = newSelectedFoods[key];
                                                            
                                                            // Find first empty slot or append
                                                            const emptySlotIdx = currentSelections.findIndex(s => !s.foodId);
                                                            const targetIdx = emptySlotIdx >= 0 ? emptySlotIdx : currentSelections.length;

                                                            newSelectedFoods[key][targetIdx] = {
                                                                foodId: fullFood.id,
                                                                grams: Number(grams.toFixed(1)),
                                                                calculatedExchanges: calculatedExchanges,
                                                                nutritionValueId: nutritionValue?.id,
                                                                _foodRef: fullFood,
                                                                isFromRecipe: true
                                                            };
                                                        });

                                                        // Update state
                                                        if (newGroupsAdded) {
                                                            updatedMeals[mealIndex] = currentMeal;
                                                            setLocalMeals(updatedMeals);
                                                            toast.success('Se agregaron grupos de alimentos faltantes al tiempo de comida');
                                                        }

                                                        setSelectedFoods(newSelectedFoods);
                                                        toast.success('Receta aplicada correctamente');
                                                    } catch (error) {
                                                        console.error(error);
                                                        toast.error('Error al cargar la receta');
                                                    } finally {
                                                        setLoadingRecipeMealId(null);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Foods List */}
                                    <div className="p-8 space-y-6">
                                        {meal.meal_plan_exchanges?.map((ex) => {
                                            const key = `${meal.id}-${ex.id}`;
                                            const numSelectors = Math.ceil(ex.quantity);
                                            const currentSelections = selectedFoods[key] || Array.from({ length: numSelectors }, () => ({ grams: 0, calculatedExchanges: 0 }));

                                            const handleAddFood = () => {
                                                const newSelections = [...currentSelections, { grams: 0, calculatedExchanges: 0, shouldAutoOpen: true }];
                                                setSelectedFoods({ ...selectedFoods, [key]: newSelections });
                                            };

                                            const handleUpdateSelection = (idx: number, updates: Partial<IFoodSelection>, food?: IFoodItem) => {
                                                const newSelections = [...currentSelections];
                                                const current = newSelections[idx] || { grams: 0, calculatedExchanges: 0 };

                                                const targetFood = food || current._foodRef;
                                                let calculatedExchanges = current.calculatedExchanges;
                                                let grams = current.grams;

                                                if (targetFood) {
                                                    const nutritionValueId = updates.nutritionValueId !== undefined ? updates.nutritionValueId : current.nutritionValueId;

                                                    // Find the specific nutrition value to use
                                                    const nutritionValue = targetFood.food_nutrition_values?.find(nv => nv.id === nutritionValueId)
                                                        || targetFood.food_nutrition_values?.[0];

                                                    if (nutritionValue) {
                                                        const baseSize = parseFloat(String(nutritionValue.base_serving_size)) || 1;

                                                        if (updates.calculatedExchanges !== undefined) {
                                                            calculatedExchanges = updates.calculatedExchanges;
                                                            if (baseSize > 0) {
                                                                grams = calculatedExchanges * baseSize;
                                                            }
                                                        } else if (updates.grams !== undefined) {
                                                            grams = updates.grams;
                                                            if (baseSize > 0) {
                                                                calculatedExchanges = grams / baseSize;
                                                            }
                                                        } else if (updates.nutritionValueId !== undefined) {
                                                            // Recalculate based on new nutrition value's base size
                                                            // If we keep the same "quantity" (exchanges), update grams
                                                            if (baseSize > 0) {
                                                                grams = calculatedExchanges * baseSize;
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    if (updates.grams !== undefined) grams = updates.grams;
                                                    if (updates.calculatedExchanges !== undefined) calculatedExchanges = updates.calculatedExchanges;
                                                }

                                                newSelections[idx] = {
                                                    ...current,
                                                    ...updates,
                                                    grams: Number(grams.toFixed(1)),
                                                    calculatedExchanges,
                                                    _foodRef: food || current._foodRef
                                                };
                                                setSelectedFoods({ ...selectedFoods, [key]: newSelections });
                                            };

                                            return (
                                                <div key={ex.id} className="space-y-4 p-6 rounded-4xl bg-gray-50/50 border border-gray-100">
                                                    {/* Group Info Header */}
                                                    <div className="flex items-center justify-between mb-2 px-2">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-3 h-3 rounded-full ring-2 ring-white shadow-sm"
                                                                style={{ backgroundColor: groupsMap[ex.exchange_group_id]?.color_code || '#cbd5e1' }}
                                                            />
                                                            <span className="text-sm font-black text-gray-700 uppercase tracking-tight">
                                                                {groupsMap[ex.exchange_group_id]?.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {planId && !fromMenuId && ex.quantity > 0 ? (
                                                                <>
                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Objetivo:</span>
                                                                    <span className="px-3 py-1 bg-white rounded-full border border-gray-100 text-xs font-black text-emerald-600 shadow-sm">
                                                                        {ex.quantity} eq
                                                                    </span>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    {/* Selectors for this exchange group */}
                                                    <div className="space-y-3">
                                                        {currentSelections.map((_, idx) => (
                                                            <div key={idx} className="flex flex-col md:flex-row items-center gap-4">
                                                                <div className="flex-1 w-full">
                                                                    <FoodSelector
                                                                        groupId={ex.exchange_group_id}
                                                                        value={currentSelections[idx]?.foodId}
                                                                        excludeIds={currentSelections.map((s, sIdx) => sIdx !== idx ? s.foodId : null).filter(Boolean) as number[]}
                                                                        autoOpen={currentSelections[idx]?.shouldAutoOpen}
                                                                        onChange={(food) => {
                                                                            // Default to first nutrition value
                                                                            const nutritionValue = food.food_nutrition_values?.find(nv => nv.id === currentSelections[idx]?.nutritionValueId) || food.food_nutrition_values?.[0];

                                                                            const baseSize = parseFloat(String(nutritionValue?.base_serving_size)) || 1;

                                                                            // Default to 1 full exchange worth of grams (using baseSize as 1 equivalent)
                                                                            const defaultGrams = baseSize * 1;

                                                                            handleUpdateSelection(idx, {
                                                                                foodId: food.id,
                                                                                grams: food.id === currentSelections[idx]?.foodId ? currentSelections[idx].grams : Number(defaultGrams.toFixed(1)),
                                                                                nutritionValueId: nutritionValue?.id
                                                                            }, food);
                                                                        }}
                                                                    />
                                                                </div>

                                                                {currentSelections[idx]?.foodId && (
                                                                    <div className="flex items-center gap-3 w-full md:w-auto animate-in fade-in slide-in-from-right-4 duration-300">
                                                                        {currentSelections[idx].isFromRecipe && (
                                                                            <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-200 shadow-sm" title="Este alimento proviene de una receta">
                                                                                <ChefHat className="w-3 h-3" />
                                                                                <span className="text-[10px] font-bold uppercase tracking-wide">Receta</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="relative group/input">
                                                                            <input
                                                                                type="number"
                                                                                value={currentSelections[idx].grams || ''}
                                                                                onChange={(e) => handleUpdateSelection(idx, { grams: Number(e.target.value) })}
                                                                                className="w-24 px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-emerald-500 shadow-sm outline-none transition-all"
                                                                            />
                                                                            <span className="absolute -top-2 left-3 px-1 bg-white text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">
                                                                                {(() => {
                                                                                    const sel = currentSelections[idx];
                                                                                    const food = sel?._foodRef;
                                                                                    const nv = food?.food_nutrition_values?.find(n => n.id === sel.nutritionValueId) || food?.food_nutrition_values?.[0];
                                                                                    return nv?.base_unit || food?.base_unit || 'Gramos';
                                                                                })()}
                                                                            </span>
                                                                        </div>

                                                                        <div className="relative group/input pl-2 border-l border-gray-100">
                                                                            <input
                                                                                type="number"
                                                                                value={Number(currentSelections[idx].calculatedExchanges.toFixed(2))}
                                                                                onChange={(e) => handleUpdateSelection(idx, { calculatedExchanges: Number(e.target.value) })}
                                                                                className="w-20 px-3 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-emerald-500 shadow-sm outline-none transition-all text-center"
                                                                            />
                                                                            <span className="absolute -top-2 left-4 px-1 bg-white text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none">Equiv.</span>
                                                                        </div>

                                                                        {/* Delete Row Button */}
                                                                        <button
                                                                            onClick={() => {
                                                                                const newSelections = currentSelections.filter((_, sIdx) => sIdx !== idx);
                                                                                setSelectedFoods({ ...selectedFoods, [key]: newSelections });
                                                                            }}
                                                                            className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                                            title="Eliminar alimento"
                                                                        >
                                                                            <Trash className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={handleAddFood}
                                                        className="w-full py-3 mt-4 flex items-center justify-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest border border-dashed border-gray-200 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all group/btn"
                                                    >
                                                        <div className="p-1 bg-gray-100 rounded-full group-hover/btn:bg-emerald-100 transition-colors">
                                                            <Utensils className="w-3 h-3" />
                                                        </div>
                                                        Agregar alimento
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                ))
                            }
                        </div>
                    </>
                )}
            </div>

                </motion.div>

                {/* Fixed Sidebar */}
                <AnimatePresence mode="popLayout">
                    {focusedMealId && (
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed top-0 right-0 h-screen w-[40%] bg-white z-50 shadow-2xl border-l border-gray-100"
                        >
                            <div className="h-full w-full overflow-y-auto p-8 custom-scrollbar">
                                <MacroSidebar
                                    focusedMealName={focusedMeal?.meal_name}
                                    focusedStats={(focusedMealId !== null && stats.meals[focusedMealId]) ? stats.meals[focusedMealId] : { calories: 0, protein: 0, carbs: 0, fat: 0 }}
                                    globalStats={stats.global}
                                    focusedMicros={(focusedMealId !== null && stats.mealsMicros[focusedMealId]) ? stats.mealsMicros[focusedMealId] : {}}
                                    globalMicros={stats.globalMicros}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Fixed Bottom Actions - centered in main content */}
                <div className="fixed bottom-8 left-0 right-0 z-40 pointer-events-none">
                    <div className="max-w-[1920px] mx-auto px-2 md:px-2 flex items-start gap-2">
                        {/* Spacer to match main content left side */}
                        <div className="flex-1 min-w-0 flex justify-center">
                            <div className={`
                            bg-white/90 backdrop-blur-xl border border-gray-200/50 
                                rounded-[2.5rem] p-4 shadow-2xl shadow-emerald-900/10 ring-1 ring-black/5 flex items-center 
                                justify-center gap-2 pointer-events-auto w-auto min-w-fit px-12`
                            }>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <button
                                        onClick={() => navigate(-1)}
                                        className="flex-1 md:flex-none px-6 py-3 text-xs font-black text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all uppercase tracking-widest"
                                    >
                                        Cancelar
                                    </button>

                                    <div className="flex bg-emerald-500 hover:bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-500/25 transition-all group/save">
                                        <button
                                            onClick={() => handleSaveMenu()}
                                            disabled={isSaving || !client}
                                            className="px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black flex items-center justify-center gap-2 uppercase tracking-widest text-xs border-r border-black/10 rounded-l-2xl hover:bg-white/10 transition-colors"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Guardando...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4" />
                                                    Guardar Menú
                                                </>
                                            )}
                                        </button>
                                        <Menu as="div" className="relative flex">
                                            <Menu.Button 
                                                disabled={isSaving}
                                                className="px-2 hover:bg-white/10 transition-colors rounded-r-2xl flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronDown className="w-4 h-4" />
                                            </Menu.Button>
                                            <Menu.Items className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-1 focus:outline-none z-50 overflow-hidden">
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={() => setIsReusableModalOpen(true)}
                                                            className={`block w-full text-left px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${active ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'}`}
                                                        >
                                                            <ChefHat className="w-4 h-4" />
                                                            Guardar como reutilizable
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            </Menu.Items>
                                        </Menu>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Spacer to match sidebar width if open */}
                        {focusedMealId && <div className="w-[40vw] hidden md:block shrink-0" />}
                    </div>
                </div>




                {/* Save Reusable Menu Modal */}
                <Modal
                    isOpen={isReusableModalOpen}
                    onClose={() => setIsReusableModalOpen(false)}
                    title="Guardar como menú reutilizable"
                    size="md"
                >
                    <div className="space-y-6 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                Título <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={reusableForm.title}
                                onChange={(e) => setReusableForm({ ...reusableForm, title: e.target.value })}
                                placeholder="Ej. Dieta Definición 2500kcal"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Descripción (Opcional)</label>
                            <textarea
                                value={reusableForm.description}
                                onChange={(e) => setReusableForm({ ...reusableForm, description: e.target.value })}
                                placeholder="Detalles sobre el plan, macronutrientes, etc..."
                                rows={4}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-gray-400 resize-none"
                            />
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-4">
                            <button
                                onClick={() => setIsReusableModalOpen(false)}
                                className="px-5 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all uppercase tracking-wide"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmReusable}
                                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 uppercase tracking-wide text-xs"
                            >
                                Confirmar y Guardar
                            </button>
                        </div>
                    </div>
                </Modal>

                {/* Client Selection Modal */}
                <Modal
                    isOpen={isClientModalOpen}
                    onClose={() => setIsClientModalOpen(false)}
                    title="Seleccionar Cliente"
                    size="xl"
                >
                    <div className="space-y-6 pt-2 h-[75vh] flex flex-col">
                        {/* Search Bar */}
                        <div className="relative shrink-0">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-base font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-gray-400"
                                placeholder="Buscar por nombre o email..."
                                value={clientQuery}
                                onChange={(e) => setClientQuery(e.target.value)}
                                autoFocus
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <span className="px-2 py-1 bg-white rounded border border-gray-200">↑</span>
                                <span className="px-2 py-1 bg-white rounded border border-gray-200">↓</span>
                                <span>Navegar</span>
                                <span className="px-2 py-1 bg-white rounded border border-gray-200 ml-2">Enter</span>
                                <span>Seleccionar</span>
                            </div>
                        </div>

                        {/* Clients Grid */}
                        <div className="flex-1 overflow-y-auto px-1 custom-scrollbar py-2">
                            {filteredClients.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 pb-12">
                                    <Search className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="font-bold text-lg">No se encontraron clientes</p>
                                    <p className="text-sm">Intenta buscar con otros términos</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                                    {filteredClients.map((c, idx) => (
                                        <div
                                            key={c.id}
                                            id={`client-card-${idx}`}
                                            onClick={() => {
                                                const newParams = new URLSearchParams(searchParams);
                                                newParams.set('clientId', c.id.toString());
                                                navigate(`?${newParams.toString()}`, { replace: true });
                                                setIsClientModalOpen(false);
                                            }}
                                            className={`
                                                group cursor-pointer rounded-3xl p-4 transition-all duration-200 border-2 flex items-center gap-4
                                                ${idx === selectedClientIndex
                                                    ? 'bg-emerald-50 border-emerald-500 shadow-xl shadow-emerald-500/10 scale-[1.02]'
                                                    : 'bg-white border-transparent hover:border-gray-200 hover:shadow-lg hover:scale-[1.01]'
                                                }
                                                ${client?.id === c.id ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}
                                            `}
                                        >
                                            <div className="shrink-0 relative">
                                                <div className={`
                                                    w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black uppercase shadow-sm
                                                    ${idx === selectedClientIndex ? 'bg-emerald-200 text-emerald-700' : 'bg-gray-100 text-gray-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors'}
                                                `}>
                                                    {c.profile_picture ? (
                                                        <img src={c.profile_picture} alt={c.name} className="w-full h-full rounded-2xl object-cover" />
                                                    ) : (
                                                        (c.name || '?').charAt(0)
                                                    )}
                                                </div>
                                                {client?.id === c.id && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className={`font-black text-sm truncate leading-tight mb-0.5 ${idx === selectedClientIndex ? 'text-gray-900' : 'text-gray-700'}`}>
                                                    {c.name}
                                                </h3>
                                                <p className="text-xs font-medium text-gray-400 truncate mb-1.5">
                                                    {c.email}
                                                </p>
                                                {c.phone_number && (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${idx === selectedClientIndex ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                                                        <span className="text-[10px] font-bold text-gray-400">{c.phone_number}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>


                {/* Saving Overlay */}
                <AnimatePresence>
                    {isSaving && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6 max-w-sm w-full mx-4"
                            >
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Save className="w-6 h-6 text-emerald-500" />
                                    </div>
                                </div>
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-black text-gray-900">Guardando Menú</h3>
                                    <p className="text-sm font-medium text-gray-500">
                                        Por favor espera mientras procesamos tu solicitud...
                                    </p>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>


            {client && (
                <AssignMenuModal 
                    isOpen={isAssignMenuModalOpen}
                    onClose={() => setIsAssignMenuModalOpen(false)}
                    clientName={client.name || ''}
                    professionalId={professional?.sub ? Number(professional.sub) : undefined}
                    onConfirm={(menuIds) => setAlternateMenuIds(menuIds)}
                />
            )}
        </div>
    );
}

function FoodSelector({
    groupId,
    value,
    onChange,
    excludeIds = [],
    autoOpen
}: {
    groupId: number;
    value?: number;
    onChange: (food: IFoodItem) => void;
    excludeIds?: number[];
    autoOpen?: boolean;
}) {
    const { data: foods, isLoading } = useGetFoodsByExchangeGroup(groupId);
    const [isOpen, setIsOpen] = useState(autoOpen || false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filteredFoods = useMemo(() => {
        let list = foods || [];
        if (excludeIds.length > 0) {
            list = list.filter(f => !excludeIds.includes(f.id));
        }
        return list.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [foods, searchQuery, excludeIds]);

    const selectedFood = useMemo(() => (foods || []).find(f => f.id === value), [foods, value]);

    // Reset selection when query or visibility changes
    useEffect(() => {
        if (isOpen) setSelectedIndex(0);
    }, [searchQuery, isOpen]);

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Grid navigation logic (assuming 3 columns for lg, 2 for sm)
            const cols = window.innerWidth >= 1024 ? 3 : (window.innerWidth >= 640 ? 2 : 1);
            
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, filteredFoods.length - 1));
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + cols, filteredFoods.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - cols, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredFoods[selectedIndex]) {
                    onChange(filteredFoods[selectedIndex]);
                    setIsOpen(false);
                }
            } else if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredFoods, selectedIndex, onChange]);

    // Scroll selected item into view
    useEffect(() => {
        if (isOpen) {
            const el = document.getElementById(`food-card-${selectedIndex}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [selectedIndex, isOpen]);


    return (
        <>
            <button 
                onClick={() => {
                    setSearchQuery('');
                    setIsOpen(true);
                }}
                disabled={isLoading}
                className="relative w-full pl-6 pr-12 py-4 bg-gray-50 rounded-2xl text-left hover:bg-white hover:ring-2 hover:ring-emerald-500 transition-all shadow-sm group disabled:opacity-50"
            >
                {isLoading ? (
                    <span className="block truncate text-sm font-bold text-gray-400 italic animate-pulse">
                        Cargando alimentos...
                    </span>
                ) : selectedFood ? (
                    <div className="flex flex-col">
                        <span className="block truncate text-sm font-black text-gray-900 tracking-tight">
                            {selectedFood.name}
                        </span>
                        <span className="block truncate text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">
                            {selectedFood.base_serving_size} {selectedFood.base_unit}
                        </span>
                    </div>
                ) : (
                    <span className="block truncate text-sm font-bold text-gray-400 italic">
                        Seleccionar alimento...
                    </span>
                )}
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                    <ChevronDown className="h-5 w-5 text-gray-400 group-hover:text-emerald-500 transition-colors" aria-hidden="true" />
                </span>
            </button>

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Seleccionar Alimento"
                size="xl"
            >
                <div className="space-y-6 pt-2 h-[75vh] flex flex-col">
                    {/* Search Bar */}
                    <div className="relative shrink-0">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar alimento por nombre..."
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-base font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-gray-400"
                            autoFocus
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <span className="px-2 py-1 bg-white rounded border border-gray-200">↑</span>
                            <span className="px-2 py-1 bg-white rounded border border-gray-200">↓</span>
                            <span>Navegar</span>
                            <span className="px-2 py-1 bg-white rounded border border-gray-200 ml-2">Enter</span>
                            <span>Seleccionar</span>
                        </div>
                    </div>

                    {/* Food Grid */}
                    <div className="flex-1 overflow-y-auto px-2 custom-scrollbar py-2">
                        {isLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                                {Array.from({ length: 9 }).map((_, idx) => (
                                    <div key={idx} className="rounded-3xl p-3 border-2 border-transparent bg-white flex flex-col gap-3 animate-pulse">
                                        <div className="aspect-video w-full rounded-2xl bg-gray-100" />
                                        <div className="px-1 pb-1 flex flex-col h-full gap-2">
                                            <div className="h-4 bg-gray-100 rounded w-3/4" />
                                            <div className="mt-auto pt-2 flex items-center justify-between">
                                                <div className="h-3 bg-gray-100 rounded w-1/4" />
                                                <div className="h-3 bg-gray-100 rounded w-1/3" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredFoods.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                                {filteredFoods.map((food, idx) => (
                                    <div
                                        key={food.id}
                                        id={`food-card-${idx}`}
                                        onClick={() => {
                                            onChange(food);
                                            setIsOpen(false);
                                        }}
                                        className={`
                                            group cursor-pointer rounded-3xl p-3 transition-all duration-200 border-2 flex flex-col gap-3
                                            ${idx === selectedIndex
                                                ? 'bg-emerald-50 border-emerald-500 shadow-xl shadow-emerald-500/10 scale-[1.02]'
                                                : 'bg-white border-transparent hover:border-gray-200 hover:shadow-lg hover:scale-[1.01]'
                                            }
                                        `}
                                    >
                                        {/* Image Area */}
                                        <div className="aspect-video w-full rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center relative overflow-hidden shrink-0">
                                            {food.image_url ? (
                                                <img 
                                                    src={food.image_url} 
                                                    alt={food.name} 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <>
                                                    <div className="absolute inset-0 opacity-10" style={{
                                                        backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)',
                                                        backgroundSize: '16px 16px'
                                                    }} />
                                                    <Utensils className={`w-8 h-8 ${idx === selectedIndex ? 'text-emerald-600' : 'text-emerald-300'} transition-colors duration-300`} />
                                                </>
                                            )}
                                        </div>

                                        <div className="px-1 pb-1 flex flex-col h-full">
                                            <h3 className={`font-black text-sm leading-tight mb-1 line-clamp-2 ${idx === selectedIndex ? 'text-emerald-900' : 'text-gray-900'}`}>
                                                {food.name}
                                            </h3>
                                            
                                            <div className="mt-auto pt-2 flex items-center justify-between">
                                                <span className={`text-[10px] font-bold uppercase tracking-wide ${idx === selectedIndex ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                    {food.base_serving_size} {food.base_unit}
                                                </span>
                                                {food.brand && (
                                                     <span className="text-[10px] font-medium text-gray-400 truncate max-w-[60%]">
                                                        {food.brand}
                                                     </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 pb-12">
                                <Search className="w-12 h-12 mb-4 opacity-20" />
                                <p className="font-bold text-lg">No se encontraron alimentos</p>
                                <p className="text-sm">Intenta buscar con otros términos</p>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </>
    );
}

function MealIcon({ name }: { name: string }) {
    const n = name.toLowerCase();
    if (n.includes('desayuno') || n.includes('breakfast')) return <Sun className="w-7 h-7 text-amber-500" />;
    if (n.includes('comida') || n.includes('lunch')) return <CloudSun className="w-7 h-7 text-blue-400" />;
    if (n.includes('cena') || n.includes('dinner')) return <Moon className="w-7 h-7 text-indigo-500" />;
    return <Utensils className="w-7 h-7 text-emerald-500" />;
}

function RecipeSelector({
    onSelect,
    isLoading
}: {
    onSelect: (recipeId: number) => void;
    isLoading?: boolean;
}) {
    const { data: recipes, isLoading: isRecipesLoading } = useGetRecipes();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filteredRecipes = useMemo(() => {
        return recipes?.filter(r => r.name.toLowerCase().includes(query.toLowerCase())) || [];
    }, [recipes, query]);

    // Reset selection when query or visibility changes
    useEffect(() => {
        if (isOpen) setSelectedIndex(0);
    }, [query, isOpen]);

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, filteredRecipes.length - 1));
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredRecipes[selectedIndex]) {
                    onSelect(filteredRecipes[selectedIndex].id);
                    setIsOpen(false);
                }
            } else if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredRecipes, selectedIndex, onSelect]);

    // Scroll selected item into view if needed
    useEffect(() => {
        if (isOpen) {
            const el = document.getElementById(`recipe-card-${selectedIndex}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [selectedIndex, isOpen]);

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                disabled={isLoading}
                className="relative w-full md:w-72 pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm disabled:opacity-75 disabled:cursor-wait hover:border-emerald-300 group"
            >
                <span className={`block truncate text-sm font-bold ${isLoading ? 'text-emerald-600 animate-pulse' : 'text-gray-700'}`}>
                    {isLoading ? 'Cargando ingredientes...' : (isRecipesLoading ? 'Cargando recetas...' : 'Elegir receta...')}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                    <ChevronDown className="h-5 w-5 text-gray-400 group-hover:text-emerald-500 transition-colors" aria-hidden="true" />
                </span>
            </button>

            {/* Selection Modal */}
            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Seleccionar Receta"
                size="xl"
            >
                <div className="space-y-6 pt-2 h-[75vh] flex flex-col">
                    {/* Search Bar */}
                    <div className="relative shrink-0">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar receta por nombre..."
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-base font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-gray-400"
                            autoFocus
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <span className="px-2 py-1 bg-white rounded border border-gray-200">↑</span>
                            <span className="px-2 py-1 bg-white rounded border border-gray-200">↓</span>
                            <span>Navegar</span>
                            <span className="px-2 py-1 bg-white rounded border border-gray-200 ml-2">Enter</span>
                            <span>Seleccionar</span>
                        </div>
                    </div>

                    {/* Recipe Grid */}
                    <div className="flex-1 overflow-y-auto px-1 custom-scrollbar py-2">
                        {filteredRecipes.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                                {filteredRecipes.map((recipe, idx) => (
                                    <div
                                        key={recipe.id}
                                        id={`recipe-card-${idx}`}
                                        onClick={() => {
                                            onSelect(recipe.id);
                                            setIsOpen(false);
                                        }}
                                        className={`
                                            group cursor-pointer rounded-3xl p-3 transition-all duration-200 border-2
                                            ${idx === selectedIndex
                                                ? 'bg-emerald-50 border-emerald-500 shadow-xl shadow-emerald-500/10 scale-[1.02]'
                                                : 'bg-white border-transparent hover:border-gray-200 hover:shadow-lg hover:scale-[1.01]'
                                            }
                                        `}
                                    >
                                        {/* Placeholder Image Area */}
                                        <div className="aspect-4/3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center mb-4 relative overflow-hidden">
                                            <div className="absolute inset-0 opacity-10" style={{
                                                backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)',
                                                backgroundSize: '16px 16px'
                                            }} />
                                            <ChefHat className={`w-12 h-12 ${idx === selectedIndex ? 'text-emerald-600' : 'text-emerald-300'} transition-colors duration-300`} />
                                        </div>

                                        <div className="px-2 pb-2">
                                            <h3 className={`font-black text-base leading-tight mb-1 ${idx === selectedIndex ? 'text-emerald-900' : 'text-gray-900'}`}>
                                                {recipe.name}
                                            </h3>
                                            <p className={`text-xs font-medium line-clamp-2 ${idx === selectedIndex ? 'text-emerald-600/70' : 'text-gray-400'}`}>
                                                {recipe.description || 'Sin descripción disponible'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 pb-12">
                                <Search className="w-12 h-12 mb-4 opacity-20" />
                                <p className="font-bold text-lg">No se encontraron recetas</p>
                                <p className="text-sm">Intenta buscar con otros términos</p>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>


        </>
    );
}

interface SortableMealTabProps {
    meal: IMealPlanMeal;
    activeTabId: number | null;
    setActiveTabId: (id: number | null) => void;
    editingTabId: number | null;
    setEditingTabId: (id: number | null) => void;
    renameValue: string;
    setRenameValue: (val: string) => void;
    handleRenameTab: (id: number, name: string) => void;
    handleDeleteTab: (e: React.MouseEvent, id: number) => void;
    mealsCount: number;
}

function SortableMealTab({
    meal,
    activeTabId,
    setActiveTabId,
    editingTabId,
    setEditingTabId,
    renameValue,
    setRenameValue,
    handleRenameTab,
    handleDeleteTab,
    mealsCount
}: SortableMealTabProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: meal.id! });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => setActiveTabId(meal.id || null)}
            className={`
                group relative flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all cursor-pointer min-w-fit select-none
                ${activeTabId === meal.id
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-white border-gray-100 text-gray-400 hover:border-emerald-200 hover:text-emerald-500'
                }
            `}
        >
            {editingTabId === meal.id ? (
                <div className="flex items-center gap-2"
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    onKeyDown={e => e.stopPropagation()}
                >
                    <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameTab(meal.id!, renameValue);
                        }}
                        autoFocus
                        onBlur={() => handleRenameTab(meal.id!, renameValue)}
                        className="w-32 bg-white/20 text-white placeholder:text-white/50 border-none outline-none text-sm font-bold rounded px-1"
                    />
                </div>
            ) : (
                <div className="flex items-center gap-3" onDoubleClick={() => {
                    setEditingTabId(meal.id || null);
                    setRenameValue(meal.meal_name || '');
                }}>
                    {/* Drag Handle Indicator only on hover/active */}
                    <GripVertical className={`w-4 h-4 opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing ${activeTabId === meal.id ? 'text-white' : 'text-gray-300'}`} />

                    <MealIcon name={meal.meal_name || ''} />
                    <span className="text-sm font-bold whitespace-nowrap">{meal.meal_name}</span>
                    {activeTabId === meal.id && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditingTabId(meal.id || null);
                                setRenameValue(meal.meal_name || '');
                            }}
                            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                            onPointerDown={e => e.stopPropagation()}
                        >
                            <Pencil className="w-3 h-3 text-white/70" />
                        </button>
                    )}
                    {mealsCount > 1 && (
                        <button
                            onClick={(e) => handleDeleteTab(e, meal.id!)}
                            className={`
                                p-1 rounded-lg transition-colors
                                ${activeTabId === meal.id
                                    ? 'hover:bg-red-500/20 text-white/50 hover:text-white'
                                    : 'hover:bg-red-50 text-gray-300 hover:text-red-500'
                                }
                            `}
                            onPointerDown={e => e.stopPropagation()}
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
