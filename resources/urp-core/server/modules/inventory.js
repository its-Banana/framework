import * as alt from 'alt-server';

import db from 'mysql2-wrapper';
import Core from '../main';

//  Items
const useableItems = {}

// TODO
// const droppedItems = []

// const dropItem = () => {
//     droppedItems.push()
// }

const createUseableItem = (itemName, eventName, isServer = false) => {
    if(useableItems[itemName]) throw new Error('Item already registered')
    useableItems[itemName] = {
        eventName: eventName,
        isServer: isServer
    }
}

const triggerItemEvent = (source, item) => {
    if(!useableItems[item.name]) return;
    if(useableItems[item.name].isServer){
        alt.emit(useableItems[item.name].eventName, source, item)
        return;
    }
    alt.emitClient(source, useableItems[item.name].eventName, item)
}

const isUseableItem = (itemName) => {
    return useableItems[itemName]
}

//  Inventory
const getCurrentWeight = (inventory) =>{
    let weight = 0
    if(!inventory) return;
    for (let i = 0; i < inventory.length; i++) {
        weight = !inventory[i] ? weight : weight + (inventory[i].weight * inventory[i].amount)
    }
    return parseInt(weight)
}

const getItemSlot = (inventory, item) => {
    if(!item || !inventory) return;
    for (let i = 0; i < inventory.length; i++) {
    if(inventory[i]){
        if(inventory[i].name.toLowerCase() === item.toLowerCase()){
          return i
        }
    }
    }
    return undefined
}

const addItem = (source, item, amount, slot, info) => {
    const totalWeight = getCurrentWeight(source.playerData.inventory)
    const itemInfo = Core.Shared.Items[item.toLowerCase()]
    if(!itemInfo){
       alt.emitClient(source,'notify', 'error', Core.Translate('INVENTORY.LABEL'), 
       Core.Translate('ITEM_DOESNT_EXISTS'))
        return false;
    }
    if(!slot){
        slot = getItemSlot(source.playerData.inventory, item)
    }
    amount = parseInt(amount)
    slot = parseInt(slot)
    if(itemInfo.type === 'weapon'){
        info = {
            serie: '99999'
        }
    }
    // Verify total weight
    if(totalWeight + (itemInfo.weight * amount) <= Core.Config.MaxWeight){
        if(!itemInfo.unique && (slot || slot === 0) && !source.playerData.inventory[slot]){
            source.playerData.inventory[slot] = {
                name: itemInfo.name,
                amount: amount,
                info: info || '',
                label: itemInfo.label,
                description: itemInfo.description || '',
                weight: itemInfo.weight,
                type: itemInfo.type,
                unique: itemInfo.unique,
                useable: itemInfo.useable,
                image: itemInfo.image,
                shouldClose: itemInfo.shouldClose,
                slot: slot,
                combinable: itemInfo.combinable
            }
            saveInventory(source)
            return true
        }
        if(slot || slot === 0 && source.playerData.inventory[slot] && source.playerData.inventory[slot].name.toLowerCase() === item.toLowerCase() && itemInfo.type === 'item' && !itemInfo.unique){
            source.playerData.inventory[slot].amount = source.playerData.inventory[slot].amount + amount
            saveInventory(source)
            return true
        }
        if(itemInfo.unique || !slot && slot !== 0 || itemInfo.type === 'weapon'){
            for(let i = 0; i < Core.Config.MaxInvSlots; i++){
                if(!source.playerData.inventory[i]){
                    source.playerData.inventory[i] = {
                        name: itemInfo.name,
                        amount: amount,
                        info: info || '',
                        label: itemInfo.label,
                        description: itemInfo.description || '',
                        weight: itemInfo.weight,
                        type: itemInfo.type,
                        unique: itemInfo.unique,
                        useable: itemInfo.useable,
                        image: itemInfo.image,
                        shouldClose: itemInfo.shouldClose,
                        slot: i,
                        combinable: itemInfo.combinable
                    }
                    saveInventory(source)
                    return true
                }
            }
        }
    }
    alt.emitClient(source,'notify', 'error', Core.Translate('INVENTORY.LABEL'), Core.Translate('INVENTORY.FULL'))
    return false
}

const removeItem = (source, item, amount) => {
    amount = parseInt(amount)

    const slot = getItemSlot(source.playerData.inventory, item)
    if(!slot) return false;

    if(source.playerData.inventory[slot].amount > amount){
        source.playerData.inventory[slot].amount = source.playerData.inventory[slot].amount - amount
        saveInventory(source)
        return true
    }
    if(source.playerData.inventory[slot].amount === amount){
        source.playerData.inventory[slot] = undefined
        saveInventory(source)
        return true
    }
    return false
}

const getItemBySlot = (source, slot) => {
    return source.playerData.inventory[slot]
}

const saveInventory = async (source) => {
    if(!source) return;
    const { inventory, ssn } = source.playerData;
    db.execute('UPDATE characters SET inventory = ? WHERE ssn = ?', [JSON.stringify(inventory), ssn], undefined, alt.resourceName)
    Core.Functions.emitPlayerData(source, 'inventory', inventory)
}

const useWeapon = async (source, weaponName) => {
    const wHash = alt.hash(weaponName)
    if(!wHash) return;

    if(!source.playerData.lastWeapon){
        source.playerData.lastWeapon = { equipped: true, weapon: weaponName }
        source.giveWeapon(wHash, 9999, true);
        return
    }
    
    if(source.playerData.lastWeapon.weapon !== weaponName){
        const oldHash = alt.hash(source.playerData.lastWeapon.weapon)
        source.removeWeapon(oldHash)
        source.playerData.lastWeapon = { equipped: true, weapon: weaponName }
        source.giveWeapon(wHash, 9999, true)
        return
    }

    if(!source.playerData.lastWeapon.equipped){
        source.playerData.lastWeapon = { equipped: true, weapon: weaponName }
        source.giveWeapon(wHash, 9999, true)
        return
    }
}

export default {getCurrentWeight, getItemSlot, addItem, removeItem, saveInventory, createUseableItem, triggerItemEvent, isUseableItem, 
    useWeapon, getItemBySlot}